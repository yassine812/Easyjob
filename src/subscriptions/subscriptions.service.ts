import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PlanType, Prisma, SubscriptionStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../companies/company-access.service';
import {
  PaymentProvider,
  DevPaymentProvider,
  StripePaymentProvider,
  PaymentRouting,
  type WebhookEvent,
} from '../payments/payment.provider';
import { KonnectPaymentProvider } from '../payments/konnect.provider';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../queues/email/email.service';
import { CONFIG, type AppConfig } from '../config/configuration';
import { EntitlementService } from '../entitlements/entitlement.service';
import { generateToken } from '../common/utils/tokens';
import { planDefinition, mergePlanFeatures } from './plan-catalog';
import { CurrencyConversionService, toProviderMinorUnits, type PaymentCurrency } from '../payments/currency-conversion.service';
import { CompanyBillingService } from './company-billing.service';
import { InvoiceService } from './invoice.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CompanyAccessService,
    private readonly paymentProvider: PaymentProvider,
    private readonly devPaymentProvider: DevPaymentProvider,
    private readonly stripePaymentProvider: StripePaymentProvider,
    private readonly konnectPaymentProvider: KonnectPaymentProvider,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly emailService: EmailService,
    private readonly entitlements: EntitlementService,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Optional() private readonly currencyConversion: CurrencyConversionService | undefined = undefined,
    @Optional() private readonly companyBilling: CompanyBillingService | undefined = undefined,
    @Optional() private readonly invoices: InvoiceService | undefined = undefined,
  ) {}

  /** Commercial price policy is owned by the catalogue; persisted rows are refreshed by seed but never trusted for checkout amounts. */
  private effectivePlanPricing<T extends { type: PlanType; name: string; priceCents: number; priceTndCents?: number | null; pricesJson?: unknown }>(plan: T): T {
    const definition = planDefinition(plan.type, plan.name);
    return definition ? { ...plan, priceCents: definition.priceCents, priceTndCents: definition.priceCents, pricesJson: { TND: definition.priceCents } } : plan;
  }

  async listPlans(type?: PlanType) {
    const plans = await this.prisma.plan.findMany({
      where: { active: true, ...(type ? { type } : {}) },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    });
    return plans.map((plan) => {
      const features = mergePlanFeatures(plan.type, plan.name, plan.features);
      const definition = planDefinition(plan.type, plan.name);
      const priceCents = definition?.priceCents ?? plan.priceCents;
      const amountMinor = plan.currency.toUpperCase() === 'TND' ? priceCents * 10 : priceCents;
      return {
        ...plan,
        ...(definition ? { priceCents, priceTndCents: priceCents, pricesJson: { TND: priceCents } } : {}),
        features,
        amountMinor,
        displayAmount: formatPlanAmount(priceCents, plan.currency),
        displayName: definition?.displayName,
        positioning: definition?.positioning,
        highlights: definition?.highlights,
        billingCountry: plan.type === PlanType.CANDIDATE ? (this.config.billing?.country ?? 'TN') : undefined,
        billingCurrency: plan.type === PlanType.CANDIDATE ? (this.config.billing?.currency ?? 'TND') : undefined,
        paymentAvailable: plan.type === PlanType.CANDIDATE ? this.config.payment.konnect?.enabled === true : undefined,
      };
    });
  }

  async quote(planId: string, billingCountry?: string, requestedCurrency?: string) {
    if (!planId) throw new BadRequestException('planId is required');
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan?.active) throw new NotFoundException('Plan not found');
    const pricedPlan = this.effectivePlanPricing(plan);
    const routing = await this.resolveCheckoutRouting(billingCountry, requestedCurrency, pricedPlan);
    return { ...routing, amountMinor: routing.providerAmountMinor ?? toProviderMinorUnits(routing.amountCents, routing.currency) };
  }

  /** Resolves the owner (candidate profile or company) with authorization. */
  private async resolveOwner(
    userId: string,
    ownerType: PlanType,
    companyId?: string,
  ): Promise<{ ownerType: PlanType; ownerId: string; email: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (ownerType === 'CANDIDATE') {
      const profile = await this.prisma.candidateProfile.findUnique({ where: { userId } });
      if (!profile) throw new ForbiddenException('No candidate profile for this account');
      return { ownerType, ownerId: profile.id, email: user.email };
    }

    if (!companyId) {
      throw new BadRequestException('companyId is required for company subscriptions');
    }
    await this.access.assertPermission(userId, companyId, 'billing.manage');
    return { ownerType, ownerId: companyId, email: user.email };
  }

  /** Server-side provider routing engine. Reference prices remain TND; currency is resolved on the server. */
  resolvePaymentRouting(
    billingCountry?: string,
    plan?: { priceCents: number; currency?: string; priceTndCents?: number | null; pricesJson?: unknown },
  ): PaymentRouting {
    const configuredCountry = this.config.billing?.country ?? 'TN';
    const country = (billingCountry || configuredCountry).toUpperCase().trim();
    if (!plan) throw new BadRequestException('Plan pricing is required');
    if (this.config.payment.provider === 'dev' && this.config.env === 'test') {
      const currency = (plan.currency ?? 'USD').toUpperCase();
      if (currency !== 'TND' && currency !== 'USD' && currency !== 'EUR') throw new BadRequestException('Unsupported plan currency');
      return { provider: 'DEV', currency, amountCents: plan.priceCents, billingCountry: country };
    }
    if (this.config.payment.provider === 'dev') throw new BadRequestException('Online payments are not configured yet');

    if (this.config.payment.konnect?.enabled !== true) throw new BadRequestException('Online payment is temporarily unavailable');
    const amountCents = plan.currency?.toUpperCase() === 'TND' || plan.currency?.toUpperCase() === 'EUR' || plan.currency?.toUpperCase() === 'USD'
      ? plan.priceCents
      : plan.priceTndCents ?? (plan.pricesJson as Record<string, number> | null)?.TND;
    if (amountCents == null || !Number.isSafeInteger(amountCents) || amountCents < 0) throw new BadRequestException('Billing reference pricing is not configured for this plan');
    const paymentCurrency = (plan.currency?.toUpperCase() ?? 'TND') as PaymentCurrency;
    return { provider: 'KONNECT', currency: paymentCurrency, amountCents, billingCountry: country };
  }

  private async resolveCheckoutRouting(
    billingCountry: string | undefined,
    requestedCurrency: string | undefined,
    plan: { priceCents: number; currency?: string; priceTndCents?: number | null; pricesJson?: unknown },
  ): Promise<PaymentRouting> {
    const currency = (requestedCurrency ?? plan.currency ?? this.config.billing?.currency ?? 'TND').toUpperCase() as PaymentCurrency;
    if (!(this.config.billing?.allowedCurrencies ?? ['TND', 'EUR', 'USD']).includes(currency)) throw new BadRequestException('Unsupported payment currency');
    const baseAmountTndCents = plan.currency?.toUpperCase() === 'TND' || !plan.currency ? plan.priceCents : plan.priceTndCents ?? plan.priceCents;
    if (currency === 'TND') {
      return { ...this.resolvePaymentRouting(billingCountry, { ...plan, currency: 'TND', priceCents: baseAmountTndCents }), baseAmountTndCents, providerAmountMinor: toProviderMinorUnits(baseAmountTndCents, 'TND'), exchangeRate: 1 };
    }
    if (this.config.payment.provider === 'dev' && this.config.env === 'test') {
      const amountCents = plan.currency?.toUpperCase() === currency ? plan.priceCents : baseAmountTndCents;
      return { provider: 'DEV', currency, amountCents, billingCountry: (billingCountry ?? this.config.billing?.country ?? 'TN').toUpperCase(), baseAmountTndCents, providerAmountMinor: toProviderMinorUnits(amountCents, currency), exchangeRate: amountCents / baseAmountTndCents };
    }
    if (!this.currencyConversion) throw new ServiceUnavailableException('Foreign-currency quotes are not configured');
    const quote = await this.currencyConversion.quote(baseAmountTndCents, currency);
    const routed = this.resolvePaymentRouting(billingCountry, { ...plan, currency, priceCents: quote.targetAmountCents, priceTndCents: baseAmountTndCents });
    return { ...routed, baseAmountTndCents, providerAmountMinor: toProviderMinorUnits(quote.targetAmountCents, currency), exchangeRate: quote.exchangeRate };
  }

  async getCurrent(userId: string, ownerType: PlanType, companyId?: string) {
    const owner = await this.resolveOwner(userId, ownerType, companyId);
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        ownerType: owner.ownerType,
        ...(owner.ownerType === 'CANDIDATE' ? { candidateId: owner.ownerId } : { companyId: owner.ownerId }),
        status: { in: ['TRIALING', 'ACTIVE'] },
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
      },
      include: { plan: true, payments: { orderBy: { createdAt: 'desc' }, take: 10 } },
      orderBy: { createdAt: 'desc' },
    });
    if (subscription) {
      const currentPlanRecord = this.effectivePlanPricing(subscription.plan);
      const plan = {
        ...currentPlanRecord,
        features: mergePlanFeatures(subscription.plan.type, subscription.plan.name, subscription.plan.features),
        amountMinor: currentPlanRecord.currency.toUpperCase() === 'TND' ? currentPlanRecord.priceCents * 10 : currentPlanRecord.priceCents,
        displayAmount: formatPlanAmount(currentPlanRecord.priceCents, currentPlanRecord.currency),
        positioning: planDefinition(subscription.plan.type, subscription.plan.name)?.positioning,
        highlights: planDefinition(subscription.plan.type, subscription.plan.name)?.highlights,
        displayName: planDefinition(subscription.plan.type, subscription.plan.name)?.displayName,
      };
      return { ...this.subscriptionDto(subscription), subscription: this.subscriptionDto(subscription), plan };
    }
    const activePlan = await this.entitlements.getActivePlan(owner);
    const record = await this.prisma.plan.findUnique({ where: { id: activePlan.planId } });
    const plan = record ? this.effectivePlanPricing(record) : null;
    return plan ? {
      plan: {
        ...this.effectivePlanPricing(plan),
        features: activePlan.features,
        amountMinor: plan.currency.toUpperCase() === 'TND' ? plan.priceCents * 10 : plan.priceCents,
        displayAmount: formatPlanAmount(plan.priceCents, plan.currency),
        positioning: planDefinition(plan.type, plan.name)?.positioning,
        highlights: planDefinition(plan.type, plan.name)?.highlights,
        displayName: planDefinition(plan.type, plan.name)?.displayName,
      },
      subscription: null,
    } : { plan: activePlan, subscription: null };
  }

  async checkout(
    userId: string,
    dto: { planId: string; ownerType: PlanType; companyId?: string; billingCountry?: string; currency?: string },
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan || !plan.active) throw new NotFoundException('Plan not found');
    const pricedPlan = this.effectivePlanPricing(plan);
    if (pricedPlan.priceCents === 0) {
      throw new BadRequestException('This plan is free and does not require checkout');
    }
    if (plan.type !== dto.ownerType) {
      throw new BadRequestException('Plan type does not match owner type');
    }

    const owner = await this.resolveOwner(userId, dto.ownerType, dto.companyId);
    if (owner.ownerType === 'COMPANY') {
      await this.companyBilling?.assertFits(owner.ownerId, plan);
    }
    const renewingStripe = await this.prisma.subscription.findFirst({ where: {
      ownerType: owner.ownerType, ...(owner.ownerType === 'CANDIDATE' ? { candidateId: owner.ownerId } : { companyId: owner.ownerId }),
      provider: 'STRIPE', status: { in: ['ACTIVE', 'TRIALING'] }, canceledAt: null,
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
    } });
    if (renewingStripe) throw new BadRequestException('Cancel renewal of your current Stripe subscription before purchasing another plan');
    const routing = await this.resolveCheckoutRouting(dto.billingCountry, dto.currency, pricedPlan);
    const orderId = `ord_${generateToken(12)}`;

    // Select provider implementation based on routing
    let providerImpl: PaymentProvider = this.paymentProvider;
    if (routing.provider === 'KONNECT') providerImpl = this.konnectPaymentProvider;
    if (routing.provider === 'STRIPE') providerImpl = this.stripePaymentProvider;
    if (routing.provider === 'DEV') providerImpl = this.devPaymentProvider;

    const checkoutReq = {
      plan: {
        id: plan.id,
        name: pricedPlan.name,
        type: pricedPlan.type,
        priceCents: routing.amountCents,
        currency: routing.currency,
        basePriceTndCents: routing.baseAmountTndCents ?? pricedPlan.priceCents,
        providerAmountMinor: routing.providerAmountMinor,
        billingInterval: pricedPlan.billingInterval,
      },
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      email: owner.email,
      billingCountry: routing.billingCountry,
      orderId,
      successUrl: `${this.config.frontendUrl}/payments/success?ref=${orderId}&companyId=${dto.companyId || ''}`,
      cancelUrl: `${this.config.frontendUrl}/payments/cancel?ref=${orderId}&companyId=${dto.companyId || ''}`,
    };

    const result = await providerImpl.createCheckout(checkoutReq);

    // Ensure pending subscription record
    const subscription = await this.prisma.subscription.create({
        data: {
          ownerType: owner.ownerType,
          ...(owner.ownerType === 'CANDIDATE'
            ? { candidateId: owner.ownerId }
            : { companyId: owner.ownerId }),
          planId: plan.id,
          provider: routing.provider,
          providerSubscriptionId: orderId,
          status: SubscriptionStatus.PENDING,
        },
      });

    // Record PENDING payment transaction in database
    const payment = await this.prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        provider: routing.provider,
        providerPaymentId: result.providerReference,
        providerSubscriptionId: orderId,
        orderId,
        amountCents: routing.amountCents,
        baseAmountTndCents: routing.baseAmountTndCents ?? pricedPlan.priceCents,
        paymentAmountMinor: routing.providerAmountMinor ?? routing.amountCents,
        providerExchangeRate: routing.exchangeRate,
        providerConvertedAmount: routing.providerAmountMinor,
        currency: routing.currency,
        billingCountry: routing.billingCountry,
        status: PaymentStatus.PENDING,
      },
    });

    await this.audit.log({
      actorId: userId,
      action: 'billing.checkout_started',
      entityType: 'Plan',
      entityId: plan.id,
      metadata: { ownerType: owner.ownerType, ownerId: owner.ownerId, provider: routing.provider, orderId },
    });

    return {
      checkoutUrl: result.checkoutUrl,
      providerReference: result.providerReference,
      paymentId: payment.id,
      orderId,
      provider: routing.provider,
      currency: routing.currency,
      amountCents: routing.amountCents,
    };
  }

  async getPaymentStatus(userId: string, ref: string) {
    if (!ref) throw new BadRequestException('Payment reference is required');
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [{ providerPaymentId: ref }, { orderId: ref }, { id: ref }],
      },
      include: { subscription: { include: { plan: true, candidate: { select: { userId: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      return { status: 'PENDING', message: 'Payment reference not found yet.' };
    }
    if (payment.subscription.ownerType === 'CANDIDATE') {
      if (payment.subscription.candidate?.userId !== userId) throw new ForbiddenException('Payment belongs to another account');
    } else if (!payment.subscription.companyId || !(await this.isCompanyBillingManager(userId, payment.subscription.companyId))) {
      throw new ForbiddenException('Payment belongs to another company');
    }

    return {
      id: payment.id,
      status: payment.status,
      amountCents: payment.amountCents,
      baseAmountTndCents: payment.baseAmountTndCents,
      paymentAmountMinor: payment.paymentAmountMinor ?? payment.amountCents,
      providerExchangeRate: payment.providerExchangeRate,
      providerConvertedAmount: payment.providerConvertedAmount,
      currency: payment.currency,
      provider: payment.provider,
      billingCountry: payment.billingCountry,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt,
      planName: payment.subscription?.plan ? planDefinition(payment.subscription.plan.type, payment.subscription.plan.name)?.displayName ?? payment.subscription.plan.name : 'Business',
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    const events = await this.paymentProvider.handleWebhook(rawBody, signature);
    const processed: string[] = [];
    for (const event of events) {
      await this.processWebhookEvent(event, this.config.payment.provider.toUpperCase());
      processed.push(event.type);
    }
    return { received: true, events: processed };
  }

  async handleKonnectWebhook(rawBody: Buffer, signature: string | undefined) {
    const events = await this.konnectPaymentProvider.handleWebhook(rawBody, signature);
    const processed: string[] = [];
    for (const event of events) {
      await this.processWebhookEvent(event, 'KONNECT');
      processed.push(event.type);
    }
    return { received: true, events: processed };
  }

  private async processWebhookEvent(event: WebhookEvent, provider: string): Promise<void> {
    const supported = ['checkout.session.completed', 'invoice.paid', 'invoice.payment_failed', 'subscription.canceled'];
    if (!supported.includes(event.type)) return;
    if (!event.providerPaymentId && !event.providerSubscriptionId) throw new BadRequestException('Missing payment reference');
    let completedInvoiceId: string | undefined;
    try {
      await this.prisma.$transaction(async (tx) => {
        if (event.id) {
          await tx.processedWebhookEvent.create({ data: { provider, eventId: event.id } });
        }
        const refs: Prisma.PaymentWhereInput[] = [];
        if (event.providerPaymentId) refs.push({ providerPaymentId: event.providerPaymentId });
        if (event.providerSubscriptionId) refs.push({ orderId: event.providerSubscriptionId });
        const exactPayment = event.providerPaymentId ? await tx.payment.findFirst({
          where: { provider, providerPaymentId: event.providerPaymentId },
          include: { subscription: { include: { plan: true } } },
        }) : null;
        const referencedPayment = exactPayment ?? await tx.payment.findFirst({
          where: { provider, OR: refs },
          include: { subscription: { include: { plan: true } } },
        });
        // A renewal invoice must never overwrite the successful purchase that
        // originally created this subscription, even when order references match.
        const payment = referencedPayment?.status === PaymentStatus.SUCCEEDED && event.providerPaymentId
          && referencedPayment.providerPaymentId !== event.providerPaymentId ? null : referencedPayment;
        const subscription = referencedPayment?.subscription ?? (event.providerSubscriptionId
          ? await tx.subscription.findFirst({
              where: { provider, providerSubscriptionId: event.providerSubscriptionId },
              include: { plan: true },
            }) : null);
        // Roll back the dedupe record too: the checkout record may not have committed yet.
        if (!subscription) throw new NotFoundException('Unknown payment reference');
        const success = event.type === 'checkout.session.completed' || event.type === 'invoice.paid';
        if (success) {
          if (payment?.status === PaymentStatus.SUCCEEDED) return;
          if (event.amountCents == null || !event.currency) throw new BadRequestException('Missing verified payment amount');
          // Renewals keep the subscribed price/currency even if the public
          // catalogue has since changed. Pending checkouts use their own snapshot.
          const previousPayment = payment ? null : referencedPayment?.status === PaymentStatus.SUCCEEDED
            ? referencedPayment : await tx.payment.findFirst({
              where: { subscriptionId: subscription.id, status: PaymentStatus.SUCCEEDED },
              orderBy: { createdAt: 'desc' }, select: { amountCents: true, currency: true },
            });
          const expectedAmount = payment?.amountCents ?? previousPayment?.amountCents ?? subscription.plan.priceCents;
          const expectedCurrency = payment?.currency ?? previousPayment?.currency ?? subscription.plan.currency;
          if (event.amountCents !== expectedAmount || event.currency.toUpperCase() !== expectedCurrency.toUpperCase()) {
            throw new BadRequestException('Payment amount or currency does not match checkout');
          }
          const now = new Date();
          const periodStart = event.periodStart ? new Date(Number(event.periodStart) * 1000) : now;
          const periodEnd = event.periodEnd ? new Date(Number(event.periodEnd) * 1000)
            : addMonths(now, subscription.plan.billingInterval === 'YEARLY' ? 12 : 1);
          if (!Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime()) || periodEnd <= periodStart) {
            throw new BadRequestException('Invalid subscription period');
          }
          // A verified new purchase replaces access only after payment succeeds.
          await tx.subscription.updateMany({
            where: { id: { not: subscription.id }, ownerType: subscription.ownerType,
              ...(subscription.candidateId ? { candidateId: subscription.candidateId } : { companyId: subscription.companyId }),
              status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
            data: { status: SubscriptionStatus.CANCELED, canceledAt: now },
          });
          await tx.subscription.update({
            where: { id: subscription.id },
            data: { status: SubscriptionStatus.ACTIVE, currentPeriodStart: periodStart, currentPeriodEnd: periodEnd,
              canceledAt: null, ...(event.providerSubscriptionId && provider === 'STRIPE'
                ? { providerSubscriptionId: event.providerSubscriptionId } : {}) },
          });
          if (payment) await tx.payment.update({
            where: { id: payment.id }, data: {
              status: PaymentStatus.SUCCEEDED,
              paidAt: now,
              providerPaymentId: event.providerPaymentId || payment.providerPaymentId,
              paymentAmountMinor: event.paymentAmountMinor ?? payment.paymentAmountMinor ?? event.amountCents,
              providerExchangeRate: event.providerExchangeRate,
              providerConvertedAmount: event.providerConvertedAmount,
            },
          });
          else await tx.payment.create({
            data: { subscriptionId: subscription.id, provider, providerPaymentId: event.providerPaymentId,
              providerSubscriptionId: event.providerSubscriptionId, amountCents: event.amountCents,
              baseAmountTndCents: planDefinition(subscription.plan.type, subscription.plan.name)?.priceCents ?? subscription.plan.priceCents,
              paymentAmountMinor: event.paymentAmountMinor ?? event.amountCents,
              providerExchangeRate: event.providerExchangeRate,
              providerConvertedAmount: event.providerConvertedAmount,
              currency: event.currency.toUpperCase(), status: PaymentStatus.SUCCEEDED, paidAt: now },
          });
          const paidPayment = await tx.payment.findFirst({ where: { subscriptionId: subscription.id, status: PaymentStatus.SUCCEEDED, ...(event.providerPaymentId ? { providerPaymentId: event.providerPaymentId } : {}) }, orderBy: { paidAt: 'desc' }, select: { id: true } });
          if (paidPayment && subscription.plan.priceCents > 0) {
            const invoice = await this.invoices?.createForPayment(tx, paidPayment.id, periodStart, periodEnd);
            completedInvoiceId = invoice?.id;
          }
          const recipient = subscription.candidateId
            ? (await tx.candidateProfile.findUnique({ where: { id: subscription.candidateId }, select: { userId: true } }))?.userId
            : subscription.companyId ? (await tx.companyMember.findFirst({ where: { companyId: subscription.companyId, role: 'COMPANY_ADMIN', status: 'ACTIVE' }, select: { userId: true } }))?.userId : undefined;
          if (recipient) await tx.notification.create({ data: { userId: recipient, type: 'subscription.activated', title: 'Subscription activated', message: 'Your subscription is active.' } });
        } else if (event.type === 'invoice.payment_failed') {
          if (payment?.status === PaymentStatus.SUCCEEDED) return;
          await tx.subscription.update({ where: { id: subscription.id }, data: { status: SubscriptionStatus.PAST_DUE } });
          if (payment) await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
          else await tx.payment.create({ data: { subscriptionId: subscription.id, provider,
            providerPaymentId: event.providerPaymentId, providerSubscriptionId: event.providerSubscriptionId,
            amountCents: event.amountCents ?? subscription.plan.priceCents, currency: event.currency ?? subscription.plan.currency,
            status: PaymentStatus.FAILED } });
          const recipient = subscription.candidateId
            ? (await tx.candidateProfile.findUnique({ where: { id: subscription.candidateId }, select: { userId: true } }))?.userId
            : subscription.companyId ? (await tx.companyMember.findFirst({ where: { companyId: subscription.companyId, role: 'COMPANY_ADMIN', status: 'ACTIVE' }, select: { userId: true } }))?.userId : undefined;
          if (recipient) await tx.notification.create({ data: { userId: recipient, type: 'payment.failed', title: 'Payment failed', message: 'Your subscription payment could not be completed.' } });
        } else {
          await tx.subscription.update({ where: { id: subscription.id }, data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() } });
        }
      });
      if (completedInvoiceId) await this.invoices?.finalize(completedInvoiceId);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') return;
      throw error;
    }
  }
  async cancel(userId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { candidate: true },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');

    const isCompanyOwner =
      subscription.ownerType === 'COMPANY' && subscription.companyId
        ? await this.isCompanyBillingManager(userId, subscription.companyId)
        : false;
    const isCandidateOwner =
      subscription.ownerType === 'CANDIDATE' &&
      subscription.candidateId &&
      (await this.prisma.candidateProfile.findFirst({
        where: { id: subscription.candidateId, userId },
      })) !== null;

    if (!isCompanyOwner && !isCandidateOwner) {
      throw new ForbiddenException('You do not own this subscription');
    }

    if (!['ACTIVE', 'TRIALING'].includes(subscription.status)) throw new BadRequestException('Subscription is not active');
    if (!subscription.currentPeriodEnd) throw new BadRequestException('Contact support to close a subscription without an end date');
    if (subscription.canceledAt) return { success: true, message: 'Cancellation already scheduled', effectiveAt: subscription.currentPeriodEnd };

    if (subscription.providerSubscriptionId) {
      const provider = subscription.provider === 'STRIPE' ? this.stripePaymentProvider : subscription.provider === 'KONNECT' ? this.konnectPaymentProvider : this.devPaymentProvider;
      await provider.cancelSubscription(subscription.providerSubscriptionId);
    }
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { canceledAt: new Date() },
    });
    await this.audit.log({
      actorId: userId,
      action: 'billing.subscription_canceled',
      entityType: 'Subscription',
      entityId: subscriptionId,
    });
    return { success: true, message: 'Subscription will be canceled at the end of the current period', effectiveAt: subscription.currentPeriodEnd };
  }

  private async isCompanyBillingManager(userId: string, companyId: string): Promise<boolean> {
    try {
      await this.access.assertPermission(userId, companyId, 'billing.manage');
      return true;
    } catch {
      return false;
    }
  }

  private async notifyOwner(
    subscription: { candidateId: string | null; companyId: string | null; candidate?: { userId: string } | null },
    type: string,
    title: string,
  ): Promise<void> {
    const userId =
      subscription.candidate?.userId ??
      (subscription.companyId
        ? (await this.prisma.companyMember.findFirst({
            where: { companyId: subscription.companyId, role: 'COMPANY_ADMIN', status: 'ACTIVE' },
          }))?.userId
        : undefined);
    if (!userId) return;
    await this.notifications.create({
      userId,
      type,
      title,
      message: title,
    });
  }

  private subscriptionDto(subscription: {
    id: string;
    ownerType: string;
    planId: string;
    provider: string;
    status: string;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    canceledAt: Date | null;
    createdAt: Date;
    payments?: Array<{ id: string; amountCents: number; currency: string; status: string; createdAt: Date }>;
  }) {
    return {
      id: subscription.id,
      ownerType: subscription.ownerType,
      planId: subscription.planId,
      provider: subscription.provider,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      canceledAt: subscription.canceledAt,
      createdAt: subscription.createdAt,
      payments: subscription.payments ?? [],
    };
  }
}

function formatPlanAmount(cents: number, currency: string): string {
  const amount = cents / 100;
  return `${Number.isInteger(amount) ? amount : amount.toFixed(2)} ${currency}`;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

