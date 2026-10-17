import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BillingConsole } from "./workspace-billing";
import { billingCopy } from "@/lib/i18n/billing";
import { billingApi } from "@/lib/api/billing";
import type { BillingOverview, BillingPlan } from "@/lib/api/company-billing";
const state = vi.hoisted(() => ({ locale: "fr", allowed: true }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ locale: state.locale }) }));
vi.mock("@/hooks/use-auth", () => ({
  useRole: () => ({ can: () => state.allowed }),
}));
vi.mock("@/lib/api/billing", () => ({
  billingApi: {
    checkout: vi.fn().mockRejectedValue(new Error("test")),
    cancel: vi.fn().mockResolvedValue({ success: true }),
  },
}));
vi.mock("./workspace-overview", () => ({
  WorkspaceLoading: () => null,
  WorkspaceError: () => null,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const starter: BillingPlan = {
  id: "free",
  name: "TRIAL",
  priceCents: 0,
  currency: "TND",
  billingInterval: "MONTHLY",
  positioning: "positioning.TRIAL",
  excluded: ["advancedAnalysis"],
  included: ["jobManagement"],
  quotas: [{ key: "activeJobs", limit: 3 }],
};
const business: BillingPlan = {
  ...starter,
  id: "business",
  name: "BUSINESS",
  priceCents: 14900,
  positioning: "positioning.BUSINESS",
  quotas: [{ key: "activeJobs", limit: 20 }],
};
const enterprise: BillingPlan = {
  ...starter,
  id: "enterprise",
  name: "ENTERPRISE",
  priceCents: 49900,
  positioning: "positioning.ENTERPRISE",
  excluded: [],
  included: ["jobManagement", "topCandidates"],
  quotas: [{ key: "activeJobs", limit: 200 }],
};
function fixture(): BillingOverview {
  return {
    plan: enterprise,
    subscription: {
      id: "sub",
      status: "ACTIVE",
      provider: "dev-seed",
      isTest: true,
      canceledAt: null,
      currentPeriodStart: null,
      currentPeriodEnd: "2027-10-05",
    },
    billingCycle: { automaticRenewal: false, endsAt: "2027-10-05" },
    usage: [{ key: "activeJobs", used: 4, limit: 200, period: "CURRENT" }],
    usageCounts: { activeJobs: 4, "team.members": 1, "ai.analyses.monthly": 0 },
    features: enterprise.included,
    availablePlans: [starter, business, enterprise],
    payment: {
      status: "NOT_CONFIGURED",
      provider: "KONNECT",
      mode: "SANDBOX",
      savedMethod: null,
      automaticRenewal: false,
    },
    invoices: { items: [], total: 0, page: 1, limit: 6, totalPages: 0 },
  };
}
function show(data = fixture()) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <BillingConsole
        companyId="company-123"
        data={data}
        page={1}
        setPage={vi.fn()}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.locale = "fr";
  state.allowed = true;
});
describe("Company billing", () => {
  it("distinguishes test access, real quotas and empty invoices without recruitment KPIs", () => {
    show();
    expect(screen.getByText("Plan de développement")).toBeInTheDocument();
    expect(
      screen.getByText("Plan de test — aucun prélèvement"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuemax",
      "200",
    );
    expect(
      screen.getByText("Aucune facture pour le moment."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Candidatures reçues")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Résilier l’abonnement" }),
    ).not.toBeInTheDocument();
  });
  it("shows feature value, quotas and a current badge directly on cards without comparison links", () => {
    const { container } = show();
    const card = within(
      container.querySelector('article[data-current="true"]') as HTMLElement,
    );
    expect(card.getByText("Meilleurs candidats")).toBeInTheDocument();
    expect(card.getByText("200 offres actives")).toBeInTheDocument();
    expect(card.getAllByText("Formule actuelle")).toHaveLength(2);
    expect(
      card.getByRole("button", { name: "Formule actuelle" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Passer à Starter" }),
    ).toBeEnabled();
    expect(
      screen.queryByText("Voir le détail des fonctionnalités"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Historique de facturation"),
    ).not.toBeInTheDocument();
  });
  it("uses actual price and renewal for paid subscriptions", () => {
    const data = fixture();
    data.subscription!.isTest = false;
    data.billingCycle.automaticRenewal = true;
    show(data);
    expect(screen.queryByText("Plan de développement")).not.toBeInTheDocument();
    expect(screen.getByText(/Prochain renouvellement ·/)).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "Formule actuelle" }),
      ).getByText(/499/),
    ).toBeInTheDocument();
  });
  it("shows unlimited without an invented progress bar", () => {
    const data = fixture();
    data.usage[0].limit = null;
    show(data);
    expect(screen.getByText("/ Illimité")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
  it("previews lost features and prevents checkout when payment is not configured", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Choisir Business" }));
    const modal = within(screen.getByRole("dialog"));
    expect(
      modal.getByText("Fonctionnalités que vous perdrez"),
    ).toBeInTheDocument();
    expect(modal.getByText("Meilleurs candidats")).toBeInTheDocument();
    expect(
      modal.getByRole("button", {
        name: "Continuer vers le paiement sécurisé",
      }),
    ).toBeDisabled();
    expect(billingApi.checkout).not.toHaveBeenCalled();
  });
  it("blocks paid changes if current usage exceeds the target quota", () => {
    const data = fixture();
    data.payment.status = "READY";
    data.usageCounts.activeJobs = 21;
    show(data);
    fireEvent.click(screen.getByRole("button", { name: "Choisir Business" }));
    expect(
      screen.getByText("Utilisation supérieure au nouveau plan"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Continuer vers le paiement sécurisé",
      }),
    ).toBeDisabled();
  });
  it("includes the company in a confirmed checkout", async () => {
    const data = fixture();
    data.payment.status = "READY";
    show(data);
    fireEvent.click(screen.getByRole("button", { name: "Choisir Business" }));
    expect(billingApi.checkout).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Continuer vers le paiement sécurisé",
      }),
    );
    await waitFor(() =>
      expect(billingApi.checkout).toHaveBeenCalledWith({
        planId: "business",
        companyId: "company-123",
        ownerType: "COMPANY",
      }),
    );
  });
  it("shows quota impact and end date before confirming cancellation", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Gérer le plan" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Résilier l’abonnement" }),
    );
    expect(
      screen.getByText(/Votre accès restera actif jusqu’au/),
    ).toBeInTheDocument();
    expect(screen.getByText("Offres actives : 4 / 3")).toBeInTheDocument();
    expect(billingApi.cancel).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirmer la résiliation en fin de période",
      }),
    );
    await waitFor(() =>
      expect(billingApi.cancel).toHaveBeenCalledWith({ subscriptionId: "sub" }),
    );
  });
  it("renders invoice links only when supplied", () => {
    const data = fixture();
    data.invoices.items = [
      {
        id: "inv",
        createdAt: "2026-10-01",
        amountCents: 14900,
        currency: "TND",
        status: "SUCCEEDED",
        invoiceUrl: "https://invoice.example/inv",
      },
    ];
    show(data);
    expect(
      screen.getByRole("link", { name: "Consulter la facture" }),
    ).toHaveAttribute("href", "https://invoice.example/inv");
    expect(screen.getByText("Payé")).toBeInTheDocument();
  });
  it("prevents read-only users from changing plans", () => {
    state.allowed = false;
    show();
    expect(
      screen.getByRole("button", { name: "Gérer le plan" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Seul un administrateur de facturation peut modifier cette formule.",
      ),
    ).toBeInTheDocument();
  });
  it.each([
    ["en", "Subscription & billing"],
    ["fr", "Abonnement et facturation"],
    ["ar", "الاشتراك والفوترة"],
  ])("renders %s with complete translations", (locale, title) => {
    state.locale = locale;
    const { container } = show();
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(container.querySelector("[dir]")).toHaveAttribute(
      "dir",
      locale === "ar" ? "rtl" : "ltr",
    );
    expect(
      Object.values(billingCopy).every(
        (row) => row.length === 3 && row.every(Boolean),
      ),
    ).toBe(true);
  });
});
