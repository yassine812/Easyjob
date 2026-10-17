import { api } from "./client";
export type BillingQuotaKey =
  "activeJobs" | "team.members" | "ai.analyses.monthly";
export interface BillingPlan {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  billingInterval: "MONTHLY" | "YEARLY";
  included: string[];
  positioning?: string;
  excluded?: string[];
  quotas: { key: BillingQuotaKey; limit: number | null }[];
}
export interface BillingOverview {
  plan: BillingPlan;
  subscription: null | {
    id: string;
    status: string;
    provider: string;
    isTest: boolean;
    canceledAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  };
  billingCycle: { automaticRenewal: boolean; endsAt: string | null };
  usage: {
    key: BillingQuotaKey;
    used: number;
    limit: number | null;
    period: string;
  }[];
  usageCounts: Record<BillingQuotaKey, number>;
  features: string[];
  availablePlans: BillingPlan[];
  payment: {
    provider: string;
    status: "READY" | "NOT_CONFIGURED";
    mode: "LIVE" | "SANDBOX";
    savedMethod: null;
    automaticRenewal: boolean;
  };
  invoices: {
    items: {
      id: string;
      createdAt: string;
      amountCents: number;
      currency: string;
      status: string;
      invoiceUrl: string | null;
      docxUrl?: string | null;
      invoiceNumber?: string | null;
    }[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
export const companyBillingApi = {
  overview: (companyId: string, page = 1) =>
    api.get<BillingOverview>(
      `/companies/${encodeURIComponent(companyId)}/billing/overview?page=${page}&limit=6`,
    ),
};
export function planChangeImpact(
  current: BillingPlan,
  next: BillingPlan,
  usage: BillingOverview["usageCounts"],
) {
  return {
    lost: current.included.filter((key) => !next.included.includes(key)),
    exceeded: next.quotas
      .filter((q) => q.limit !== null && usage[q.key] > q.limit)
      .map((q) => ({ ...q, used: usage[q.key] })),
  };
}
