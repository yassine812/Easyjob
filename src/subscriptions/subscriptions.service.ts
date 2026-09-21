import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
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
  ) {}

  async listPlans(type?: PlanType) {
    return this.prisma.plan.findMany({
      where: { active: true, ...(type ? { type } : {}) },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async quote(planId: string, billingCountry?: string) {
    if (!planId) throw new BadRequestException('planId is required');
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan?.active) throw new NotFoundException('Plan not found');
    return this.resolvePaymentRouting(billingCountry, plan);
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

  /** Server-side automatic country & provider routing engine */
  resolvePaymentRouting(
    billingCountry?: string,
    plan?: { priceCents: number; currency?: string; priceTndCents?: number | null; pricesJson?: unknown },
  ): PaymentRouting {
    const country = (billingCountry || 'TN').toUpperCase().trim();
    if (!plan) throw new BadRequestException('Plan pricing is required');
    if (this.config.payment.provider === 'dev' && this.config.env === 'test') {
      const currency = (plan.currency ?? 'USD').toUpperCase();
      if (currency !== 'TND' && currency !== 'USD' && currency !== 'EUR') throw new BadRequestException('Unsupported plan currency');
      return { provider: 'DEV', currency, amountCents: plan.priceCents, billingCountry: country };
    }
    if (this.config.payment.provider === 'dev') throw new BadRequestException('Online payments are not configured yet');

    // 1. Tunisian customers -> Konnect (TND)
    if (country === 'TN' || country === 'TUNISIA') {
      const amountCents = plan.currency?.toUpperCase() === 'TND' ? plan.priceCents
        : plan.priceTndCents ?? (plan.pricesJson as Record<string, number> | null)?.TND;
      if (amountCents == null || !Number.isSafeInteger(amountCents) || amountCents < 0) throw new BadRequestException('TND pricing is not configured for this plan');
      return {
        provider: 'KONNECT',
        currency: 'TND',
        amountCents,
        billingCountry: 'TN',
      };
    }

    // 2. International customers in Stripe-supported merchant countries -> Stripe (EUR/USD)
    const stripeCountries = ['FR', 'FRANCE', 'US', 'USA', 'UNITED STATES', 'GB', 'UK', 'UNITED KINGDOM', 'DE', 'GERMANY', 'CA', 'CANADA', 'ES', 'IT', 'BE', 'NL', 'AT', 'AU'];
    if (stripeCountries.includes(country) && this.config.payment.stripe.secretKey) {
      const currency = (plan.currency ?? 'USD').toUpperCase();
      if (currency !== 'USD' && currency !== 'EUR') throw new BadRequestException('Unsupported Stripe plan currency');
      return {
        provider: 'STRIPE',
        currency,
        amountCents: plan.priceCents,
        billingCountry: country,
      };
    }

    // 3. Fallback / Dev environment routing
    throw new BadRequestException('Payment is not configured for this billing country');
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
      return { ...this.subscriptionDto(subscription), subscription: this.subscriptionDto(subscription), plan: subscription.plan };
    }
    const activePlan = await this.entitlements.getActivePlan(owner);
    return { plan: activePlan, subscription: null };
  }

  async checkout(
    userId: string,
    dto: { planId: string; ownerType: PlanType; companyId?: string; billingCountry?: string },
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan || !plan.active) throw new NotFoundException('Plan not found');
    if (plan.priceCents === 0) {
      throw new BadRequestException('This plan is free and does not require checkout');
    }
    if (plan.type !== dto.ownerType) {
      throw new BadRequestException('Plan type does not match owner type');
    }

    const owner = await this.resolveOwner(userId, dto.ownerType, dto.companyId);
    const renewingStripe = await this.prisma.subscription.findFirst({ where: {
      ownerType: owner.ownerType, ...(owner.ownerType === 'CANDIDATE' ? { candidateId: owner.ownerId } : { companyId: owner.ownerId }),
      provider: 'STRIPE', status: { in: ['ACTIVE', 'TRIALING'] }, canceledAt: null,
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
    } });
    if (renewingStripe) throw new BadRequestException('Cancel renewal of your current Stripe subscription before purchasing another plan');
    const routing = this.resolvePaymentRouting(dto.billingCountry, plan);
    const orderId = `ord_${generateToken(12)}`;

    // Select provider implementation based on routing
    let providerImpl: PaymentProvider = this.paymentProvider;
    if (routing.provider === 'KONNECT') providerImpl = this.konnectPaymentProvider;
    if (routing.provider === 'STRIPE') providerImpl = this.stripePaymentProvider;
    if (routing.provider === 'DEV') providerImpl = this.devPaymentProvider;

    const checkoutReq = {
      plan: {
        id: plan.id,
        name: plan.name,
        type: plan.type,
        priceCents: routing.amountCents,
        currency: routing.currency,
        billingInterval: plan.billingInterval,
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
      currency: payment.currency,
      provider: payment.provider,
      billingCountry: payment.billingCountry,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt,
      planName: payment.subscription?.plan?.name || 'Business',
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
            where: { id: payment.id }, data: { status: PaymentStatus.SUCCEEDED, paidAt: now, providerPaymentId: event.providerPaymentId || payment.providerPaymentId },
          });
          else await tx.payment.create({
            data: { subscriptionId: subscription.id, provider, providerPaymentId: event.providerPaymentId,
              providerSubscriptionId: event.providerSubscriptionId, amountCents: event.amountCents,
              currency: event.currency.toUpperCase(), status: PaymentStatus.SUCCEEDED, paidAt: now },
          });
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
    return { success: true, message: 'Subscription will be canceled at the end of the current period' };
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

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

