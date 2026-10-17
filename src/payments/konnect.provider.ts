import { Inject, Injectable, Logger, BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { CONFIG, type AppConfig } from '../config/configuration';
import { generateToken, safeEqual } from '../common/utils/tokens';
import { PaymentProvider, type CheckoutRequest, type CheckoutResult, type WebhookEvent } from './payment.provider';
import { candidatePlanDisplayName } from '../subscriptions/plan-catalog';
import { toProviderMinorUnits, type PaymentCurrency } from './currency-conversion.service';

@Injectable()
export class KonnectPaymentProvider extends PaymentProvider {
  private readonly logger = new Logger(KonnectPaymentProvider.name);
  constructor(@Inject(CONFIG) private readonly config: AppConfig) { super(); }
  private get baseUrl(): string {
    if (this.config.payment.konnect?.apiBaseUrl) return this.config.payment.konnect.apiBaseUrl.replace(/\/$/, '');
    return this.config.payment.konnect?.mode === 'live'
      ? 'https://api.konnect.network/api/v2' : 'https://api.sandbox.konnect.network/api/v2';
  }
  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const { apiKey, receiverWalletId, enabled } = this.config.payment.konnect ?? {};
    if (enabled === false) throw new ServiceUnavailableException('Online subscription payment is temporarily unavailable');
    if (!apiKey || !receiverWalletId) throw new ServiceUnavailableException('Konnect is not configured');
    if (!this.config.payment.konnect?.webhookUrl) throw new ServiceUnavailableException('KONNECT_WEBHOOK_URL is required');
    const currency = req.plan.currency.toUpperCase() as PaymentCurrency;
    if (!['TND', 'EUR', 'USD'].includes(currency) || !Number.isSafeInteger(req.plan.priceCents) || req.plan.priceCents <= 0) {
      throw new BadRequestException('Invalid payment amount or currency');
    }
    const providerAmountMinor = req.plan.providerAmountMinor ?? toProviderMinorUnits(req.plan.priceCents, currency);
    if (!Number.isSafeInteger(providerAmountMinor) || providerAmountMinor <= 0) throw new BadRequestException('Invalid provider payment amount');
    const response = await fetch(`${this.baseUrl}/payments/init-payment`, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        receiverWalletId, token: currency, amount: providerAmountMinor,
        type: 'immediate', description: candidatePlanDisplayName(req.plan.name),
        acceptedPaymentMethods: ['bank_card', 'e-DINAR'], lifespan: 60,
        email: req.email, orderId: req.orderId || generateToken(12),
        webhook: this.config.payment.konnect.webhookUrl,
        successUrl: req.successUrl, failUrl: req.cancelUrl, silentWebhook: true,
      }),
    });
    if (!response.ok) throw new ServiceUnavailableException('Konnect checkout could not be created');
    const result = await response.json() as { payUrl?: string; paymentRef?: string };
    if (!result.payUrl?.startsWith('https://') || !result.paymentRef) throw new ServiceUnavailableException('Invalid Konnect checkout response');
    return { checkoutUrl: result.payUrl, providerReference: result.paymentRef };
  }
  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<WebhookEvent[]> {
    const config = this.config.payment.konnect;
    if (signature && config?.webhookSecret && !safeEqual(signature, config.webhookSecret)) {
      throw new UnauthorizedException('Invalid Konnect webhook signature');
    }
    if (!config?.apiKey) throw new ServiceUnavailableException('Konnect verification is not configured');
    const payload = JSON.parse(rawBody.toString('utf8')) as { payment_ref?: string; paymentId?: string };
    const ref = payload.payment_ref || payload.paymentId;
    if (!ref || !/^[a-zA-Z0-9_-]{1,150}$/.test(ref)) throw new BadRequestException('Invalid payment reference');
    // A callback is only a hint: verify status and amount with the provider.
    const response = await fetch(`${this.baseUrl}/payments/${encodeURIComponent(ref)}`, {
      headers: { 'x-api-key': config.apiKey }, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new ServiceUnavailableException('Could not verify Konnect payment');
    const { payment } = await response.json() as { payment?: {
      status: string; amount: number; reachedAmount?: number; token: string; orderId?: string; convertedAmount?: number; exchangeRate?: number;
    } };
    if (!payment) throw new ServiceUnavailableException('Missing verified payment details');
    if (payment.status !== 'completed') return [];
    const currency = payment.token.toUpperCase() as PaymentCurrency;
    if (!['TND', 'EUR', 'USD'].includes(currency) || !Number.isFinite(payment.amount) || payment.amount <= 0 ||
      (currency === 'TND' && payment.amount % 10 !== 0) || (payment.reachedAmount !== undefined && payment.reachedAmount < payment.amount)) {
      throw new BadRequestException('Payment amount is incomplete or invalid');
    }
    return [{
      id: `konnect_${ref}_completed`, type: 'checkout.session.completed',
      providerPaymentId: ref, providerSubscriptionId: payment.orderId || ref,
      amountCents: currency === 'TND' ? payment.amount / 10 : payment.amount,
      paymentAmountMinor: payment.amount,
      currency,
      providerExchangeRate: typeof payment.exchangeRate === 'number' ? payment.exchangeRate : undefined,
      providerConvertedAmount: typeof payment.convertedAmount === 'number' ? payment.convertedAmount : undefined,
    }];
  }
  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    this.logger.log(`Konnect period will not renew: ${providerSubscriptionId}`);
  }
}
