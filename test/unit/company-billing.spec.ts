import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { Plan } from "@prisma/client";
import {
  CompanyBillingService,
  companyPlanView,
} from "../../src/subscriptions/company-billing.service";
import { SubscriptionsService } from "../../src/subscriptions/subscriptions.service";
import type { AppConfig } from "../../src/config/configuration";

const config = { payment: { provider: "dev", konnect: {} } } as AppConfig;
const plan = {
  id: "enterprise",
  type: "COMPANY",
  name: "ENTERPRISE",
  priceCents: 89900,
  currency: "TND",
  billingInterval: "MONTHLY",
  features: {
    activeJobs: 200,
    "team.members": 1000,
    "ai.analyses.monthly": 10000,
  },
} as unknown as Plan;
function fixture() {
  const prisma = {
    subscription: {
      findFirst: jest
        .fn()
        .mockResolvedValue({
          id: "sub",
          provider: "dev-seed",
          status: "ACTIVE",
          plan,
          currentPeriodEnd: new Date("2027-10-05"),
          canceledAt: null,
        }),
    },
    plan: { findMany: jest.fn().mockResolvedValue([plan]) },
    job: { count: jest.fn().mockResolvedValue(4) },
    companyMember: { count: jest.fn().mockResolvedValue(1) },
    companyInvitation: { count: jest.fn().mockResolvedValue(2) },
    aiAnalysis: { count: jest.fn().mockResolvedValue(7) },
    payment: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  const access = { assertPermission: jest.fn() };
  return {
    prisma,
    access,
    service: new CompanyBillingService(
      prisma as never,
      access as never,
      config,
    ),
  };
}
describe("Company billing overview", () => {
  it("uses enforced job states, pending seats and calendar-month analysis usage", async () => {
    const { service, prisma } = fixture();
    const result = await service.overview("user", "company");
    expect(result.usageCounts).toEqual({
      activeJobs: 4,
      "team.members": 3,
      "ai.analyses.monthly": 7,
    });
    expect(prisma.job.count).toHaveBeenCalledWith({
      where: {
        companyId: "company",
        status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PUBLISHED"] },
      },
    });
    const filter = prisma.aiAnalysis.count.mock.calls[0][0].where;
    expect(filter.inputReference).toEqual({
      path: ["companyId"],
      equals: "company",
    });
    expect(filter.createdAt.gte.getUTCDate()).toBe(1);
    expect(filter.createdAt.gte.getUTCHours()).toBe(0);
  });
  it("marks development access without inventing payments or renewals", async () => {
    const { service, prisma } = fixture();
    const result = await service.overview("user", "company");
    expect(result.subscription?.isTest).toBe(true);
    expect(result.billingCycle.automaticRenewal).toBe(false);
    expect(result.payment.status).toBe("NOT_CONFIGURED");
    expect(result.invoices.items).toEqual([]);
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          subscription: { companyId: "company", ownerType: "COMPANY" },
          provider: { in: ["KONNECT", "STRIPE"] },
        },
      }),
    );
  });
  it("authorizes before reading company data", async () => {
    const { service, access, prisma } = fixture();
    access.assertPermission.mockRejectedValue(new ForbiddenException());
    await expect(service.overview("user", "other")).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
  });
  it("does not turn absent or negative quotas into unlimited allowances", () => {
    expect(
      companyPlanView({
        ...plan,
        name: "CUSTOM",
        features: { activeJobs: -1, "team.members": 0 },
      }).quotas,
    ).toEqual([{ key: "team.members", limit: 0 }]);
  });
  it("rejects a paid change whose quotas are already exceeded", async () => {
    const { service } = fixture();
    await expect(
      service.assertFits("company", { ...plan, name: "CUSTOM", features: { activeJobs: 3 } }),
    ).rejects.toThrow(BadRequestException);
  });
  it("requires complete Konnect configuration", () => {
    const { prisma, access } = fixture();
    const make = (key: string) =>
      new CompanyBillingService(
        prisma as never,
        access as never,
        {
          payment: {
            provider: "konnect",
            konnect: {
              enabled: true,
              apiKey: key,
              receiverWalletId: "wallet",
              webhookUrl: "https://api.example/webhook",
              mode: "sandbox",
            },
          },
        } as AppConfig,
      );
    expect(make("").paymentConfiguration().status).toBe("NOT_CONFIGURED");
    expect(make("test").paymentConfiguration()).toMatchObject({
      status: "READY",
      mode: "SANDBOX",
      savedMethod: null,
      automaticRenewal: false,
    });
  });
  it("returns provider invoices and discards unsafe invoice links", async () => {
    const { service, prisma } = fixture();
    prisma.payment.findMany.mockResolvedValue([
      { id: "a", invoiceUrl: "https://invoice.example/a" },
      { id: "b", invoiceUrl: "javascript:bad" },
    ] as never);
    const result = await service.overview("u", "c");
    expect(result.invoices.items.map((p) => p.invoiceUrl)).toEqual([
      "https://invoice.example/a",
      null,
    ]);
  });
});
describe("End-of-period cancellation", () => {
  it("keeps active access and its period, schedules once, and calls the correct provider", async () => {
    const end = new Date("2027-10-05");
    const record = {
      id: "sub",
      ownerType: "COMPANY",
      companyId: "company",
      status: "ACTIVE",
      currentPeriodEnd: end,
      canceledAt: null as Date | null,
      provider: "STRIPE",
      providerSubscriptionId: "stripe-sub",
    };
    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue(record),
        update: jest.fn().mockImplementation(({ data }) => {
          record.canceledAt = data.canceledAt;
          return record;
        }),
      },
    };
    const provider = { cancelSubscription: jest.fn() };
    const service = new SubscriptionsService(
      prisma as never,
      { assertPermission: jest.fn() } as never,
      {} as never,
      {} as never,
      provider as never,
      {} as never,
      { log: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      config,
    );
    expect(await service.cancel("user", "sub")).toMatchObject({
      success: true,
      effectiveAt: end,
    });
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub" },
      data: { canceledAt: expect.any(Date) },
    });
    expect(record.status).toBe("ACTIVE");
    expect(record.currentPeriodEnd).toBe(end);
    await service.cancel("user", "sub");
    expect(provider.cancelSubscription).toHaveBeenCalledTimes(1);
  });
});
