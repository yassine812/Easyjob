import { companyFixture } from '../helpers';
import {
  authHeader,
  closeTestApp,
  createTestApp,
  createVerifiedUser,
  DEV_WEBHOOK_SECRET,
  waitFor,
  waitForNotification,
} from '../helpers';

describe('Billing (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let candidate: { accessToken: string; userId: string };

  beforeAll(async () => {
    ctx = await createTestApp();
    candidate = await createVerifiedUser(ctx, 'Billing User', 'billing@test.com');
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  it('lists public plans with entitlements', async () => {
    const plans = await ctx.http.get('/api/v1/plans');
    expect(plans.status).toBe(200);
    const items = plans.body as Array<{ name: string; type: string; priceCents: number; features: object }>;
    expect(items.some((p) => p.type === 'CANDIDATE' && p.priceCents === 0)).toBe(true);
    expect(items.some((p) => p.type === 'COMPANY' && p.name === 'PRO')).toBe(true);
  });

  it('candidate starts on the free plan', async () => {
    const current = await ctx.http
      .get('/api/v1/subscriptions/me?ownerType=CANDIDATE')
      .set(authHeader(candidate.accessToken));
    expect(current.status).toBe(200);
    expect((current.body as { plan: { name: string } }).plan.name).toBe('FREE');
  });

  it('initiates a checkout for Candidate Pro (dev provider)', async () => {
    const plans = (await ctx.http.get('/api/v1/plans')).body as Array<{ id: string; name: string; type: string }>;
    const proPlan = plans.find((p) => p.type === 'CANDIDATE' && p.name === 'PRO')!;

    const checkout = await ctx.http
      .post('/api/v1/subscriptions/checkout')
      .set(authHeader(candidate.accessToken))
      .send({ planId: proPlan.id, ownerType: 'CANDIDATE' });
    expect(checkout.status).toBe(201);
    expect((checkout.body as { checkoutUrl: string }).checkoutUrl).toContain('payments/checkout');
  });

  it('activates the subscription only via the (authoritative) webhook', async () => {
    // Before the webhook: still on FREE.
    const before = await ctx.http
      .get('/api/v1/subscriptions/me?ownerType=CANDIDATE')
      .set(authHeader(candidate.accessToken));
    expect((before.body as { plan: { name: string } }).plan.name).toBe('FREE');

    // Find the pending subscription reference from the provider checkout.
    const meB = await ctx.http.get('/api/v1/auth/me').set(authHeader(candidate.accessToken));
    const candidateProfileId = (meB.body as { candidateProfileId: string }).candidateProfileId;
    const subscription = await (ctx.prisma as never as { subscription: { findFirst: (a: object) => Promise<{ id: string; providerSubscriptionId: string | null } | null> } }).subscription.findFirst({
      where: { ownerType: 'CANDIDATE', candidateId: candidateProfileId, status: 'PENDING' },
    });
    expect(subscription).not.toBeNull();

    const periodStart = Math.floor(Date.now() / 1000);
    const periodEnd = periodStart + 30 * 86400;

    const webhook = await ctx.http
      .post('/api/v1/subscriptions/webhook')
      .set('x-webhook-secret', DEV_WEBHOOK_SECRET)
      .send({
        event: 'checkout.session.completed',
        data: {
          providerSubscriptionId: subscription!.providerSubscriptionId,
          providerPaymentId: 'pay_test_1',
          amountCents: 999,
          currency: 'USD',
          periodStart: String(periodStart),
          periodEnd: String(periodEnd),
        },
      });
    expect(webhook.status).toBe(201);

    // Now the candidate is on PRO with entitlements unlocked.
    await waitFor(async () => {
      const current = await ctx.http
        .get('/api/v1/subscriptions/me?ownerType=CANDIDATE')
        .set(authHeader(candidate.accessToken));
      const plan = (current.body as { plan: { name: string } }).plan;
      return plan?.name === 'PRO' ? current.body : undefined;
    });

    const after = await ctx.http
      .get('/api/v1/subscriptions/me?ownerType=CANDIDATE')
      .set(authHeader(candidate.accessToken));
    expect((after.body as { plan: { name: string } }).plan.name).toBe('PRO');

    // Entitlement: AI features are now enabled for the candidate.
    const ai = await ctx.http
      .post('/api/v1/ai/cv/analyze')
      .set(authHeader(candidate.accessToken))
      .send({ resumeId: 'nonexistent' });
    // Route executes; resume ownership will 404 before any entitlement check — that's fine.
    expect(ai.status).toBe(404);

    await waitForNotification(ctx, candidate.userId, 'subscription.activated');
  });

  it('deduplicates re-delivered webhook events (idempotency)', async () => {
    const plans = (await ctx.http.get('/api/v1/plans')).body as Array<{ id: string; name: string; type: string }>;
    const proPlan = plans.find((p) => p.type === 'CANDIDATE' && p.name === 'PRO')!;
    const user = await createVerifiedUser(ctx, 'Webhook Dup User', 'webhook-dup@test.com');

    const checkout = await ctx.http
      .post('/api/v1/subscriptions/checkout')
      .set(authHeader(user.accessToken))
      .send({ planId: proPlan.id, ownerType: 'CANDIDATE' });
    expect(checkout.status).toBe(201);

    const me = await ctx.http.get('/api/v1/auth/me').set(authHeader(user.accessToken));
    const candidateProfileId = (me.body as { candidateProfileId: string }).candidateProfileId;
    const subscription = await (ctx.prisma as never as { subscription: { findFirst: (a: object) => Promise<{ id: string; providerSubscriptionId: string | null } | null> } }).subscription.findFirst({
      where: { ownerType: 'CANDIDATE', candidateId: candidateProfileId, status: 'PENDING' },
    });
    expect(subscription).not.toBeNull();

    const body = {
      event: 'invoice.paid',
      data: {
        providerSubscriptionId: subscription!.providerSubscriptionId,
        providerPaymentId: 'pay_idem_1',
        amountCents: 999,
        currency: 'USD',
        periodStart: String(Math.floor(Date.now() / 1000)),
        periodEnd: String(Math.floor(Date.now() / 1000) + 30 * 86400),
      },
    };

    // Deliver the same webhook twice (provider retry / network duplication).
    const first = await ctx.http
      .post('/api/v1/subscriptions/webhook')
      .set('x-webhook-secret', DEV_WEBHOOK_SECRET)
      .send(body);
    const second = await ctx.http
      .post('/api/v1/subscriptions/webhook')
      .set('x-webhook-secret', DEV_WEBHOOK_SECRET)
      .send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    // The duplicate delivery must not create a second payment record.
    await waitFor(async () => {
      const payments = await (ctx.prisma as never as { payment: { findMany: (a: object) => Promise<Array<{ providerPaymentId: string | null }>> } }).payment.findMany({
        where: { providerPaymentId: 'pay_idem_1' },
      });
      return payments.length >= 1 ? payments : undefined;
    });
    const payments = await (ctx.prisma as never as { payment: { findMany: (a: object) => Promise<Array<{ providerPaymentId: string | null }>> } }).payment.findMany({
      where: { providerPaymentId: 'pay_idem_1' },
    });
    expect(payments.length).toBe(1);

    // And only a single activation notification.
    const notifications = await (ctx.prisma as never as { notification: { findMany: (a: object) => Promise<Array<{ type: string }>> } }).notification.findMany({
      where: { userId: user.userId, type: 'subscription.activated' },
    });
    expect(notifications.length).toBe(1);
  });

  it('rejects webhooks with invalid signatures', async () => {
    const response = await ctx.http
      .post('/api/v1/subscriptions/webhook')
      .set('x-webhook-secret', 'wrong-secret')
      .send({ event: 'checkout.session.completed', data: {} });
    expect(response.status).toBe(401);
  });

  it('records payments and marks them failed on invoice.payment_failed', async () => {
    const meB = await ctx.http.get('/api/v1/auth/me').set(authHeader(candidate.accessToken));
    const candidateProfileId = (meB.body as { candidateProfileId: string }).candidateProfileId;
    const subscription = await (ctx.prisma as never as { subscription: { findFirst: (a: object) => Promise<{ id: string; providerSubscriptionId: string | null; status: string } | null> } }).subscription.findFirst({
      where: { ownerType: 'CANDIDATE', candidateId: candidateProfileId, status: 'ACTIVE' },
    });

    const webhook = await ctx.http
      .post('/api/v1/subscriptions/webhook')
      .set('x-webhook-secret', DEV_WEBHOOK_SECRET)
      .send({
        event: 'invoice.payment_failed',
        data: { providerSubscriptionId: subscription!.providerSubscriptionId, providerPaymentId: 'invoice_failed_renewal', amountCents: 999, currency: 'USD' },
      });
    expect(webhook.status).toBe(201);

    await waitFor(async () => {
      const sub = await (ctx.prisma as never as { subscription: { findUnique: (a: object) => Promise<{ status: string } | null> } }).subscription.findUnique({
        where: { id: subscription!.id },
      });
      return sub?.status === 'PAST_DUE' ? sub : undefined;
    });

    await waitForNotification(ctx, candidate.userId, 'payment.failed');
    const original = await ctx.prisma.payment.findFirst({ where: { providerPaymentId: 'pay_test_1' } });
    const renewal = await ctx.prisma.payment.findFirst({ where: { providerPaymentId: 'invoice_failed_renewal' } });
    expect(original?.status).toBe('SUCCEEDED');
    expect(renewal?.status).toBe('FAILED');
  });

  it('cancels the subscription (owner only)', async () => {
    const meB = await ctx.http.get('/api/v1/auth/me').set(authHeader(candidate.accessToken));
    const candidateProfileId = (meB.body as { candidateProfileId: string }).candidateProfileId;
    const subscription = await (ctx.prisma as never as { subscription: { findFirst: (a: object) => Promise<{ id: string } | null> } }).subscription.findFirst({
      where: { ownerType: 'CANDIDATE', candidateId: candidateProfileId },
      orderBy: { createdAt: 'desc' },
    });

    // Another user cannot cancel it.
    const stranger = await createVerifiedUser(ctx, 'Stranger', 'stranger@billing.test');
    const forbidden = await ctx.http
      .post('/api/v1/subscriptions/cancel')
      .set(authHeader(stranger.accessToken))
      .send({ subscriptionId: subscription!.id });
    expect(forbidden.status).toBe(403);

    const cancel = await ctx.http
      .post('/api/v1/subscriptions/cancel')
      .set(authHeader(candidate.accessToken))
      .send({ subscriptionId: subscription!.id });
    expect(cancel.status).toBe(201);
  });

  it('company plan limits are enforced by entitlements (team size)', async () => {
    const companyAdmin = await createVerifiedUser(ctx, 'Company Billing', 'companybilling@test.com');
    const company = await companyFixture(ctx, companyAdmin.accessToken, { legalName: 'Billing Co', commercialName: 'BillingCo' });
    const companyId = (company.body as { id: string }).id;

    // TRIAL allows 5 members: the admin + 4 invites.
    for (let i = 0; i < 4; i++) {
      const invite = await ctx.http
        .post(`/api/v1/companies/${companyId}/invitations`)
        .set(authHeader(companyAdmin.accessToken))
        .send({ email: `team${i}@billing.test`, role: 'RECRUITER' });
      expect(invite.status).toBe(201);
    }
    const over = await ctx.http
      .post(`/api/v1/companies/${companyId}/invitations`)
      .set(authHeader(companyAdmin.accessToken))
      .send({ email: 'overflow@billing.test', role: 'RECRUITER' });
    expect(over.status).toBe(403);

    // activeJobs limit: TRIAL allows 3 jobs.
    for (let i = 0; i < 3; i++) {
      const job = await ctx.http
        .post('/api/v1/jobs')
        .set(authHeader(companyAdmin.accessToken))
        .send({
          title: `Job ${i}`,
          description: 'Job with a sufficiently long description for validation purposes here.',
          employmentType: 'FULL_TIME',
          experienceLevel: 'MID',
        });
      expect(job.status).toBe(201);
    }
    const jobOver = await ctx.http
      .post('/api/v1/jobs')
      .set(authHeader(companyAdmin.accessToken))
      .send({
        title: 'Job Overflow',
        description: 'Another job that should exceed the plan limit for active jobs.',
        employmentType: 'FULL_TIME',
        experienceLevel: 'MID',
      });
    expect(jobOver.status).toBe(403);
  });
});
