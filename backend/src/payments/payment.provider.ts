import { createHash } from 'crypto';
import { Inject, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { CONFIG, type AppConfig } from '../config/configuration';
import { generateToken, safeEqual } from '../common/utils/tokens';

export interface CheckoutRequest {
  plan: {
    id: string;
    name: string;
    type: 'CANDIDATE' | 'COMPANY';
    priceCents: number;
    currency: string;
    /** Reference price, always stored in hundredths of TND. */
    basePriceTndCents?: number;
    /** Provider amount in its own minor unit. */
    providerAmountMinor?: number;
    billingInterval: 'MONTHLY' | 'YEARLY';
  };
  ownerType: 'CANDIDATE' | 'COMPANY';
  ownerId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
  billingCountry?: string;
  orderId?: string;
}

export interface CheckoutResult {
  checkoutUrl: string;
  providerReference: string;
}

export interface PaymentRouting {
  provider: 'KONNECT' | 'STRIPE' | 'DEV';
  currency: 'TND' | 'EUR' | 'USD';
  amountCents: number;
  billingCountry: string;
  baseAmountTndCents?: number;
  providerAmountMinor?: number;
  exchangeRate?: number;
}

export interface WebhookEvent {
  /** Provider event id — used for idempotent processing of duplicate deliveries. */
  id?: string;
  type: string;
  providerSubscriptionId: string;
  providerPaymentId?: string;
  customerEmail?: string;
  amountCents?: number;
  paymentAmountMinor?: number;
  currency?: string;
  providerExchangeRate?: number;
  providerConvertedAmount?: number;
  invoiceUrl?: string;
  periodStart?: string;
  periodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

export abstract class PaymentProvider {
  abstract createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  abstract handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<WebhookEvent[]>;
  abstract cancelSubscription(providerSubscriptionId: string): Promise<void>;
}

/**
 * Development provider used when no real gateway is configured. Checkouts are
 * "paid" by POSTing a dev webhook event (see tests and dev tooling).
 */
@Injectable()
export class DevPaymentProvider extends PaymentProvider {
  private readonly logger = new Logger(DevPaymentProvider.name);

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    super();
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    if (this.config.env !== 'test') throw new ServiceUnavailableException('Payments are not configured. Please try again later.');
    const providerReference = `dev_session_${generateToken(16)}`;
    this.logger.log(`Dev checkout created: ${providerReference} for ${req.ownerType}:${req.ownerId}`);
    return {
      checkoutUrl: `${this.config.frontendUrl}/payments/checkout?ref=${providerReference}`,
      providerReference,
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<WebhookEvent[]> {
    if (this.config.env !== 'test') throw new UnauthorizedException('Simulated payments are restricted to automated tests');
    if (!safeEqual(signature ?? '', this.config.payment.devWebhookSecret)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    const raw = rawBody.toString('utf8');
    const payload = JSON.parse(raw) as {
      event: string;
      eventId?: string;
      data: Record<string, unknown>;
    };
    const data = payload.data ?? {};
    // Stable id so re-delivered webhooks (identical body) are deduplicated.
    const eventId = payload.eventId ?? createHash('sha256').update(raw).digest('hex');
    const event: WebhookEvent = {
      id: eventId,
      type: payload.event,
      providerSubscriptionId: (data.providerSubscriptionId as string) ?? '',
      providerPaymentId: (data.providerPaymentId as string) ?? undefined,
      customerEmail: (data.customerEmail as string) ?? undefined,
      amountCents: (data.amountCents as number) ?? undefined,
      currency: (data.currency as string) ?? undefined,
      invoiceUrl: (data.invoiceUrl as string) ?? undefined,
      periodStart: (data.periodStart as string) ?? undefined,
      periodEnd: (data.periodEnd as string) ?? undefined,
      cancelAtPeriodEnd: (data.cancelAtPeriodEnd as boolean) ?? undefined,
    };
    return [event];
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    this.logger.log(`Dev cancellation requested for ${providerSubscriptionId}`);
  }
}

/**
 * Stripe adapter. Webhook events are verified with Stripe's signature scheme;
 * the frontend never reports payment success — Stripe webhooks are authoritative.
 */
@Injectable()
export class StripePaymentProvider extends PaymentProvider {
  private readonly logger = new Logger(StripePaymentProvider.name);
  private stripe: import('stripe').default | null = null;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    super();
    if (config.payment.stripe.secretKey) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Stripe = require('stripe');
      this.stripe = new Stripe(config.payment.stripe.secretKey, { apiVersion: '2024-06-20' });
    }
  }

  private priceIdFor(plan: CheckoutRequest['plan']): string {
    const key = `${plan.type === 'CANDIDATE' ? 'candidate' : 'company'}_${plan.name.toLowerCase()}_${plan.billingInterval.toLowerCase()}`;
    const priceId = this.config.payment.stripe.priceMap[key];
    if (!priceId) {
      throw new Error(`No Stripe price mapped for plan ${plan.name} (${plan.billingInterval})`);
    }
    return priceId;
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    if (!this.stripe) throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)');
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: this.priceIdFor(req.plan), quantity: 1 }],
      customer_email: req.email,
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
      metadata: {
        ownerType: req.ownerType,
        ownerId: req.ownerId,
        planId: req.plan.id,
      },
    });
    if (!session.url || !session.id) throw new Error('Stripe checkout session missing url/id');
    return { checkoutUrl: session.url, providerReference: session.id };
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<WebhookEvent[]> {
    if (!this.stripe || !this.config.payment.stripe.webhookSecret) {
      throw new Error('Stripe webhooks not configured');
    }
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature ?? '',
      this.config.payment.stripe.webhookSecret,
    );
    return [mapStripeEvent(event)];
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    if (!this.stripe) throw new Error('Stripe is not configured');
    await this.stripe.subscriptions.update(providerSubscriptionId, { cancel_at_period_end: true });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStripeEvent(event: any): WebhookEvent {
  const object = event.data?.object ?? {};
  const kind = event.type === 'checkout.session.async_payment_succeeded' ? 'checkout.session.completed' : event.type;
  const common: WebhookEvent = {
    id: event.id,
    type: kind === 'checkout.session.completed' && object.payment_status !== 'paid' ? 'checkout.pending'
      : kind === 'customer.subscription.deleted' ? 'subscription.canceled' : kind,
    providerSubscriptionId: object.subscription ?? object.id ?? '',
    providerPaymentId: object.id ?? undefined,
    customerEmail: object.customer_email ?? object.customer ?? undefined,
    amountCents:
      typeof object.amount_total === 'number'
        ? object.amount_total
        : typeof object.amount_paid === 'number'
          ? object.amount_paid
          : undefined,
    currency: object.currency ?? undefined,
    invoiceUrl: object.hosted_invoice_url ?? undefined,
    periodStart: object.current_period_start ? String(object.current_period_start) : undefined,
    periodEnd: object.current_period_end ? String(object.current_period_end) : undefined,
    cancelAtPeriodEnd: object.cancel_at_period_end ?? undefined,
  };
  return common;
}
