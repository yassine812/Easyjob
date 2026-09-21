import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';
import { KonnectPaymentProvider } from '../../src/payments/konnect.provider';
import { DevPaymentProvider } from '../../src/payments/payment.provider';
import type { AppConfig } from '../../src/config/configuration';

const config = { env: 'test', frontendUrl: 'http://localhost:3001', payment: { provider: 'dev', devWebhookSecret: 'test', stripe: { secretKey: '', priceMap: {} }, konnect: {} } } as AppConfig;
describe('Candidate plan payment boundaries', () => {
  const make = (prisma = {}) => new SubscriptionsService(prisma as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, config);
  it('uses explicit development routing without inventing Tunisian pricing', () => {
    expect(make().resolvePaymentRouting('TN', { priceCents: 1999 })).toEqual({ provider: 'DEV', currency: 'USD', amountCents: 1999, billingCountry: 'TN' });
  });
  it('does not silently invent a TND price for a real payment', () => {
    const live = { ...config, env: 'production', payment: { ...config.payment, provider: 'konnect' as const } };
    const service = new SubscriptionsService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, live);
    expect(() => service.resolvePaymentRouting('TN', { priceCents: 1999 })).toThrow(BadRequestException);
    expect(service.resolvePaymentRouting('TN', { priceCents: 1999, priceTndCents: 6200 }).amountCents).toBe(6200);
    expect(service.resolvePaymentRouting('TN', { priceCents: 999, currency: 'TND' })).toEqual({ provider: 'KONNECT', currency: 'TND', amountCents: 999, billingCountry: 'TN' });
    expect(() => service.resolvePaymentRouting('TN', { priceCents: -1, currency: 'TND' })).toThrow(BadRequestException);
  });
  it('preserves the catalogue currency in automated-test routing', () => {
    expect(make().resolvePaymentRouting('TN', { priceCents: 999, currency: 'TND' })).toEqual({ provider: 'DEV', currency: 'TND', amountCents: 999, billingCountry: 'TN' });
  });
  it('does not reveal payment details from another candidate', async () => {
    const service = make({ payment: { findFirst: jest.fn().mockResolvedValue({ subscription: { ownerType: 'CANDIDATE', candidate: { userId: 'other' } } }) } });
    await expect(service.getPaymentStatus('user', 'reference')).rejects.toThrow(ForbiddenException);
  });
  it('does not accept empty references', async () => {
    await expect(make().getPaymentStatus('user', '')).rejects.toThrow(BadRequestException);
  });
  it('does not activate an underpaid subscription', async () => {
    const tx = { processedWebhookEvent: { create: jest.fn() }, payment: { findFirst: jest.fn().mockResolvedValue({ amountCents: 1999, currency: 'USD', status: 'PENDING', subscription: { id: 'sub', plan: {} } }) }, subscription: { update: jest.fn() } };
    const prisma = { $transaction: jest.fn().mockImplementation(fn => fn(tx)) };
    const provider = { handleWebhook: async () => [{ id: 'evt', type: 'checkout.session.completed', providerPaymentId: 'payment', providerSubscriptionId: 'sub', amountCents: 999, currency: 'USD' }] };
    const service = new SubscriptionsService(prisma as never, {} as never, provider as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, config);
    await expect(service.handleWebhook(Buffer.from('{}'), 'test')).rejects.toThrow(BadRequestException);
    expect(tx.subscription.update).not.toHaveBeenCalled();
  });
  it('keeps an existing USD renewal at its paid price after the catalogue becomes TND', async () => {
    const subscription = { id: 'sub', ownerType: 'CANDIDATE', candidateId: 'candidate', plan: { priceCents: 1999, currency: 'TND', billingInterval: 'MONTHLY' } };
    const tx = { processedWebhookEvent: { create: jest.fn() },
      payment: { findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({ amountCents: 999, currency: 'USD' }), create: jest.fn(), update: jest.fn() },
      subscription: { findFirst: jest.fn().mockResolvedValue(subscription), updateMany: jest.fn(), update: jest.fn() },
      candidateProfile: { findUnique: jest.fn().mockResolvedValue(null) } };
    const prisma = { $transaction: jest.fn().mockImplementation(fn => fn(tx)) };
    const provider = { handleWebhook: async () => [{ id: 'renewal', type: 'invoice.paid', providerPaymentId: 'new-invoice', providerSubscriptionId: 'sub', amountCents: 999, currency: 'USD' }] };
    const service = new SubscriptionsService(prisma as never, {} as never, provider as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, config);
    await service.handleWebhook(Buffer.from('{}'), 'test');
    expect(tx.payment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amountCents: 999, currency: 'USD', status: 'SUCCEEDED' }) });
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.subscription.update).toHaveBeenCalled();
  });
  it('disables signed development payment events in production', async () => {
    const provider = new DevPaymentProvider({ ...config, env: 'production' });
    await expect(provider.handleWebhook(Buffer.from('{}'), 'test')).rejects.toThrow();
  });
});

describe('Konnect callbacks require authoritative verification', () => {
  afterEach(() => jest.restoreAllMocks());
  it('sends 9.99 TND as 9990 millimes and verifies it back as 999 hundredths', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => ({ payUrl: 'https://pay.example/checkout', paymentRef: 'ref' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ payment: { status: 'completed', amount: 9990, reachedAmount: 9990, token: 'TND', orderId: 'order' } }) } as Response);
    const provider = new KonnectPaymentProvider({ ...config, payment: { ...config.payment, konnect: { apiKey: 'test', receiverWalletId: 'wallet', webhookSecret: '', webhookUrl: 'https://api.example/webhook', mode: 'sandbox' } } });
    await provider.createCheckout({ plan: { id: 'pro', name: 'PRO', type: 'CANDIDATE', priceCents: 999, currency: 'TND', billingInterval: 'MONTHLY' }, ownerId: 'candidate', ownerType: 'CANDIDATE', email: 'candidate@example.test', successUrl: 'http://localhost/success', cancelUrl: 'http://localhost/cancel', orderId: 'order' });
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toMatchObject({ token: 'TND', amount: 9990 });
    expect(await provider.handleWebhook(Buffer.from('{"payment_ref":"ref"}'), undefined)).toEqual([expect.objectContaining({ amountCents: 999, currency: 'TND' })]);
  });
  it('does not simulate checkout when credentials are missing', async () => {
    const provider = new KonnectPaymentProvider(config);
    await expect(provider.createCheckout({} as never)).rejects.toThrow('Konnect is not configured');
  });
  it('ignores forged success when the provider says pending', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ payment: { status: 'pending' } }) } as Response);
    const provider = new KonnectPaymentProvider({ ...config, payment: { ...config.payment, konnect: { apiKey: 'test', receiverWalletId: 'wallet', webhookSecret: '', mode: 'sandbox' } } });
    expect(await provider.handleWebhook(Buffer.from(JSON.stringify({ payment_ref: 'ref', status: 'completed', amount: 199900 })), undefined)).toEqual([]);
  });
  it('fails closed when verification is unavailable', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    const provider = new KonnectPaymentProvider({ ...config, payment: { ...config.payment, konnect: { apiKey: 'test', receiverWalletId: 'wallet', webhookSecret: '', mode: 'sandbox' } } });
    await expect(provider.handleWebhook(Buffer.from('{"payment_ref":"ref","status":"completed"}'), undefined)).rejects.toThrow('Could not verify');
  });
});
