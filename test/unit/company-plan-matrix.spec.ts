import { ForbiddenException } from "@nestjs/common";
import type { Plan } from "@prisma/client";
import { EntitlementService } from "../../src/entitlements/entitlement.service";
import { companyPlanView } from "../../src/subscriptions/company-billing.service";
import { mergePlanFeatures } from "../../src/subscriptions/plan-catalog";
import { SubscriptionsService } from "../../src/subscriptions/subscriptions.service";
import type { AppConfig } from "../../src/config/configuration";

const cases = [
  ["TRIAL", 0, 3, 5, 0, false, false],
  ["BUSINESS", 14900, 20, 20, 100, true, false],
  ["PRO", 29900, 50, 50, 1000, true, false],
  ["ENTERPRISE", 49900, 200, 1000, 10000, true, true],
] as const;
const owner = { ownerType: "COMPANY" as const, ownerId: "company" };

describe.each(cases)(
  "%s company policy",
  (name, price, jobs, seats, requests, ai, intelligence) => {
    // Deliberately stale database values: both rendering and enforcement must use policy.
    const plan = {
      id: name,
      name,
      type: "COMPANY",
      active: true,
      currency: "TND",
      priceCents: 89900,
      billingInterval: "MONTHLY",
      features: {
        "ai.enabled": !ai,
        recruitment_intelligence: !intelligence,
        smart_job_creation: !intelligence,
        activeJobs: 999,
      },
    } as unknown as Plan;
    const prisma = {
      subscription: {
        findFirst: jest.fn().mockResolvedValue({ planId: name, plan }),
      },
      plan: {
        findMany: jest.fn().mockResolvedValue([plan]),
        findUnique: jest.fn().mockResolvedValue(plan),
      },
    };
    const entitlements = new EntitlementService(prisma as never);

    it.each([
      ["ai.enabled", ai],
      ["smart_job_creation", intelligence],
      ["recruitment_intelligence", intelligence],
    ])("enforces %s on direct backend requests", async (feature, allowed) => {
      if (allowed)
        await expect(
          entitlements.assertCan(owner, feature),
        ).resolves.toBeUndefined();
      else
        await expect(entitlements.assertCan(owner, feature)).rejects.toThrow(
          ForbiddenException,
        );
    });

    it("enforces the shared advanced matching, potential, ranking and interview assistant gate", async () => {
      if (intelligence)
        await expect(
          entitlements.assertRecruitmentIntelligence(owner.ownerId),
        ).resolves.toBeUndefined();
      else
        await expect(
          entitlements.assertRecruitmentIntelligence(owner.ownerId),
        ).rejects.toThrow(ForbiddenException);
    });

    it("returns only included capabilities and the enforced quotas on its card", () => {
      const card = companyPlanView(plan);
      expect(card.priceCents).toBe(price);
      expect(card.quotas).toEqual([
        { key: "activeJobs", limit: jobs },
        { key: "team.members", limit: seats },
        { key: "ai.analyses.monthly", limit: requests },
      ]);
      expect(card.included.includes("recruitmentAssistance")).toBe(ai);
      for (const key of [
        "advancedAnalysis",
        "growthPotential",
        "topCandidates",
        "interviewAssistant",
        "smartJobCreation",
      ]) {
        expect(card.included.includes(key)).toBe(intelligence);
      }
      expect(card.included).toEqual(
        expect.arrayContaining([
          "jobManagement",
          "applicationTracking",
          "interviewManagement",
          "notifications",
        ]),
      );
      expect(card.included).not.toContain("auto_apply");
      expect(card.included).not.toContain("prioritySupport");
    });

    it("uses the same price for public catalogue and payment quote", async () => {
      const config = {
        env: "test",
        payment: { provider: "dev", konnect: {} },
      } as AppConfig;
      const service = new SubscriptionsService(
        prisma as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        entitlements,
        config,
      );
      expect((await service.listPlans("COMPANY"))[0]).toMatchObject({
        priceCents: price,
        amountMinor: price * 10,
      });
      expect(await service.quote(name, "TN", "TND")).toMatchObject({
        amountCents: price,
        amountMinor: price * 10,
      });
    });
  },
);

it("separates candidate Pro from company Pro and retains custom plan policy", () => {
  expect(mergePlanFeatures("CANDIDATE", "PRO", {}).cv_tailoring).toBe(true);
  expect(mergePlanFeatures("COMPANY", "PRO", {}).cv_tailoring).toBeUndefined();
  expect(
    mergePlanFeatures("COMPANY", "CUSTOM", { recruitment_intelligence: true }),
  ).toEqual({ recruitment_intelligence: true });
});
