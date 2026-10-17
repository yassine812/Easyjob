import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Plan, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CompanyAccessService } from "../companies/company-access.service";
import { CONFIG, type AppConfig } from "../config/configuration";
import { companyPlanDefinition, mergePlanFeatures } from "./plan-catalog";
import { paginate, resolvePagination } from "../common/utils/pagination";
import { StorageService } from "../files/storage.service";
import { Optional } from "@nestjs/common";

export const COMPANY_QUOTAS = [
  "activeJobs",
  "team.members",
  "ai.analyses.monthly",
] as const;

export function companyPlanView(plan: Plan) {
  const features = mergePlanFeatures(plan.type, plan.name, plan.features);
  const intelligence = features.recruitment_intelligence === true;
  // Match the actual access checks; the video meeting itself is not tier-gated.
  const included = [
    "jobManagement",
    "applicationTracking",
    "interviewManagement",
    "notifications",
    ...(features["ai.enabled"] === true ? ["recruitmentAssistance"] : []),
    ...(intelligence
      ? [
          "advancedAnalysis",
          "growthPotential",
          "topCandidates",
          "interviewAssistant",
        ]
      : []),
    ...(features.smart_job_creation === true ? ["smartJobCreation"] : []),
  ];
  const quotas = COMPANY_QUOTAS.flatMap((key) => {
    const value = features[key];
    // Unknown or absent limits must not be presented as unlimited.
    return typeof value === "number" && Number.isFinite(value) && value >= 0
      ? [{ key, limit: value }]
      : [];
  });
  return {
    id: plan.id,
    name: plan.name,
    priceCents: companyPlanDefinition(plan.name)?.priceCents ?? plan.priceCents,
    positioning: companyPlanDefinition(plan.name)?.positioning,
    excluded: intelligence
      ? []
      : ["advancedAnalysis", "topCandidates", "interviewAssistant"],
    currency: plan.currency,
    billingInterval: plan.billingInterval,
    included,
    quotas,
  };
}

@Injectable()
export class CompanyBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CompanyAccessService,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Optional() private readonly storage: StorageService | undefined = undefined,
  ) {}

  paymentConfiguration() {
    const k = this.config.payment.konnect;
    const ready =
      this.config.payment.provider !== "dev" &&
      k?.enabled === true &&
      !!k.apiKey &&
      !!k.receiverWalletId &&
      !!k.webhookUrl;
    return {
      provider: "KONNECT",
      status: ready ? "READY" : "NOT_CONFIGURED",
      mode: k?.mode === "live" ? "LIVE" : "SANDBOX",
      // Konnect checkout currently collects a payment per period, not a saved card.
      savedMethod: null,
      automaticRenewal: false,
    } as const;
  }

  async usage(companyId: string) {
    const month = new Date();
    month.setUTCDate(1);
    month.setUTCHours(0, 0, 0, 0);
    const [jobs, members, invitations, analyses] = await Promise.all([
      this.prisma.job.count({
        where: {
          companyId,
          status: {
            in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PUBLISHED"],
          },
        },
      }),
      this.prisma.companyMember.count({
        where: { companyId, status: "ACTIVE" },
      }),
      this.prisma.companyInvitation.count({
        where: { companyId, status: "PENDING" },
      }),
      this.prisma.aiAnalysis.count({
        where: {
          createdAt: { gte: month },
          inputReference: { path: ["companyId"], equals: companyId },
        },
      }),
    ]);
    return {
      activeJobs: jobs,
      "team.members": members + invitations,
      "ai.analyses.monthly": analyses,
    };
  }

  async overview(
    userId: string,
    companyId: string,
    query: { page?: number; limit?: number } = {},
  ) {
    await this.access.assertPermission(userId, companyId, "billing.view");
    const now = new Date();
    const { page, limit, skip, take } = resolvePagination({
      ...query,
      limit: query.limit ?? 6,
    });
    const where: Prisma.PaymentWhereInput = {
      subscription: { companyId, ownerType: "COMPANY" },
      provider: { in: ["KONNECT", "STRIPE"] },
    };
    const [subscription, plans, counts, payments, total] = await Promise.all([
      this.prisma.subscription.findFirst({
        where: {
          ownerType: "COMPANY",
          companyId,
          status: { in: ["ACTIVE", "TRIALING"] },
          OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
        },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.plan.findMany({
        where: { type: "COMPANY", active: true },
        orderBy: { sortOrder: "asc" },
      }),
      this.usage(companyId),
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amountCents: true,
          currency: true,
          status: true,
          createdAt: true,
          invoiceUrl: true,
          invoice: { select: { number: true, pdfKey: true, docxKey: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    const record = subscription?.plan ?? plans.find((p) => p.priceCents === 0);
    if (!record) throw new NotFoundException("No company plan configured");
    const plan = companyPlanView(record);
    const isTest =
      !!subscription && /^(dev|test|manual)/i.test(subscription.provider);
    const payment = this.paymentConfiguration();
    const invoiceItems = await Promise.all(payments.map(async (p) => ({
      ...p,
      invoiceUrl: p.invoice?.pdfKey && this.storage ? await this.storage.presignedGet(p.invoice.pdfKey) : safeInvoiceUrl(p.invoiceUrl),
      docxUrl: p.invoice?.docxKey && this.storage ? await this.storage.presignedGet(p.invoice.docxKey) : null,
      invoiceNumber: p.invoice?.number ?? null,
    })));
    return {
      plan,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            provider: subscription.provider,
            isTest,
            canceledAt: subscription.canceledAt,
            currentPeriodEnd: subscription.currentPeriodEnd,
            currentPeriodStart: subscription.currentPeriodStart,
          }
        : null,
      billingCycle: {
        automaticRenewal:
          !isTest &&
          subscription?.provider === "STRIPE" &&
          !subscription.canceledAt,
        endsAt: subscription?.currentPeriodEnd ?? null,
      },
      usage: plan.quotas
        .filter((q) => q.key !== "ai.analyses.monthly" || q.limit > 0)
        .map((q) => ({
          ...q,
          used: counts[q.key],
          period:
            q.key === "ai.analyses.monthly" ? "CALENDAR_MONTH_UTC" : "CURRENT",
        })),
      usageCounts: counts,
      features: plan.included,
      availablePlans: plans.map(companyPlanView),
      payment,
      invoices: paginate(invoiceItems, total, page, limit),
    };
  }

  async assertFits(companyId: string, plan: Plan) {
    const usage = await this.usage(companyId);
    const exceeded = companyPlanView(plan).quotas.filter(
      (q) => usage[q.key] > q.limit,
    );
    if (exceeded.length)
      throw new BadRequestException({
        code: "PLAN_LIMITS_EXCEEDED",
        message: "Reduce usage before changing to this plan",
        limits: exceeded.map((q) => ({ ...q, used: usage[q.key] })),
      });
  }
}

function safeInvoiceUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}
