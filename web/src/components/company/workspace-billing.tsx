"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check, CreditCard, Crown, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { billingApi } from "@/lib/api/billing";
import {
  companyBillingApi,
  planChangeImpact,
  type BillingOverview,
  type BillingPlan,
} from "@/lib/api/company-billing";
import { useBillingText } from "@/lib/i18n/billing";
import { useI18n } from "@/lib/i18n";
import { useRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { EasyJobFeatureMark } from "@/components/ui/easyjob-feature-mark";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { WorkspaceError, WorkspaceLoading } from "./workspace-overview";
import styles from "./workspace-billing.module.css";

export function WorkspaceBilling() {
  const { companyId } = useParams<{ companyId: string }>();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["company-billing", companyId, page],
    queryFn: () => companyBillingApi.overview(companyId, page),
  });
  if (query.isPending) return <WorkspaceLoading />;
  if (query.isError)
    return (
      <WorkspaceError
        retry={() => {
          void query.refetch();
        }}
      />
    );
  return (
    <BillingConsole
      companyId={companyId}
      data={query.data}
      page={page}
      setPage={setPage}
    />
  );
}

export function BillingConsole({
  companyId,
  data,
  page,
  setPage,
}: {
  companyId: string;
  data: BillingOverview;
  page: number;
  setPage: (page: number) => void;
}) {
  const t = useBillingText();
  const { locale } = useI18n();
  const { can } = useRole();
  const qc = useQueryClient();
  const allowed = can(companyId, "billing.manage");
  const [dialog, setDialog] = useState<"manage" | "cancel" | "plan" | null>(
    null,
  );
  const [selected, setSelected] = useState<BillingPlan | null>(null);
  const { plan, subscription, payment } = data;
  const isTest = subscription?.isTest;
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  const money = (p: BillingPlan) =>
    formatMoney(p.priceCents, p.currency, locale);
  const end = data.billingCycle.endsAt
    ? date(data.billingCycle.endsAt)
    : t("noPeriod");
  const canCancel =
    !!subscription?.currentPeriodEnd && !subscription.canceledAt && allowed;
  const target =
    dialog === "cancel"
      ? data.availablePlans.find((p) => p.priceCents === 0)
      : selected;
  const impact = target
    ? planChangeImpact(plan, target, data.usageCounts)
    : null;
  const cancel = useMutation({
    mutationFn: () => billingApi.cancel({ subscriptionId: subscription!.id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["company-billing", companyId] });
      void qc.invalidateQueries({
        queryKey: ["subscription-me", "COMPANY", companyId],
      });
      setDialog(null);
      toast.success(t("saved"));
    },
    onError: () => toast.error(t("error")),
  });
  const checkout = useMutation({
    mutationFn: () =>
      billingApi.checkout({
        planId: selected!.id,
        ownerType: "COMPANY",
        companyId,
      }),
    onSuccess: (result) => {
      const url = new URL(result.checkoutUrl, window.location.origin);
      if (["https:", "http:"].includes(url.protocol))
        window.location.assign(url.href);
      else toast.error(t("error"));
    },
    onError: () => toast.error(t("error")),
  });
  function review(p: BillingPlan) {
    setSelected(p);
    setDialog(p.priceCents === 0 ? "cancel" : "plan");
  }
  const limitLabel = (limit: number | null) =>
    limit === null ? t("unlimited") : limit.toLocaleString(locale);
  return (
    <div className={styles.page} dir={locale === "ar" ? "rtl" : "ltr"}>
      <header className={styles.header}>
        <div>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
      </header>
      <section className={styles.hero} aria-label={t("current")}>
        <div className={styles.heroTop}>
          <div className={styles.planIdentity}>
            <span className={styles.crown}>
              <Crown size={25} />
            </span>
            <div>
              <p className={styles.eyebrow}>
                {t(isTest ? "testPlan" : "current")}
              </p>
              <h2>{t(plan.name)}</h2>
            </div>
          </div>
          <span className={styles.badge}>
            <span />
            {t(
              subscription?.canceledAt
                ? "scheduled"
                : isTest
                  ? "test"
                  : subscription?.status === "TRIALING"
                    ? "trial"
                    : "active",
            )}
          </span>
        </div>
        <div className={styles.heroBottom}>
          <div>
            <p className={styles.price}>
              {isTest ? formatMoney(0, plan.currency, locale) : money(plan)}
              <small>{t(plan.billingInterval)}</small>
            </p>
            <p className={styles.muted}>
              {isTest
                ? t("noCharge")
                : plan.priceCents === 0
                  ? t("free")
                  : `${t(data.billingCycle.automaticRenewal ? "renewal" : "periodEnd")} · ${end}`}
            </p>
            {isTest && (
              <p className={styles.catalogue}>
                {t("catalogue")} : {money(plan)} {t(plan.billingInterval)} ·{" "}
                {t("periodEnd")} {end}
              </p>
            )}
          </div>
          <Button onClick={() => setDialog("manage")} disabled={!allowed}>
            {t("manage")}
            <ArrowUpRight size={16} />
          </Button>
        </div>
        {!allowed && <p className={styles.muted}>{t("readOnly")}</p>}
      </section>
      <section className={styles.section} aria-labelledby="billing-usage">
        <div className={styles.sectionHeading}>
          <h2 id="billing-usage">{t("usage")}</h2>
          <p>{t("usageHelp")}</p>
        </div>
        <div className={styles.usageGrid}>
          {data.usage.map((q) => (
            <article key={q.key} className={styles.usageItem}>
              <p>{t(q.key)}</p>
              <div className={styles.usageNumbers}>
                <strong>{q.used.toLocaleString(locale)}</strong>
                <span>/ {limitLabel(q.limit)}</span>
              </div>
              {q.limit !== null && (
                <div
                  role="progressbar"
                  aria-label={t(q.key)}
                  aria-valuemin={0}
                  aria-valuemax={q.limit}
                  aria-valuenow={Math.min(q.used, q.limit)}
                  className={styles.progress}
                  data-full={q.used >= q.limit}
                >
                  <span
                    style={{
                      width: `${q.limit === 0 ? 100 : Math.min(100, (q.used / q.limit) * 100)}%`,
                    }}
                  />
                </div>
              )}
              <p className={styles.help}>
                {t(
                  q.key === "activeJobs"
                    ? "jobsHelp"
                    : q.key === "team.members"
                      ? "seatsHelp"
                      : "analysesHelp",
                )}
                {q.limit !== null && q.used >= q.limit && (
                  <span> · {t("quotaReached")}</span>
                )}
              </p>
            </article>
          ))}
        </div>
        {!data.usage.length && <p className={styles.muted}>{t("noQuotas")}</p>}
        <div className={styles.included}>
          <h3>{t("included")}</h3>
          <ul>
            {data.features.map((key) => (
              <li key={key}>
                <EasyJobFeatureMark />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className={styles.section} aria-labelledby="billing-plans">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="billing-plans">{t("plans")}</h2>
            <p>{t("plansHelp")}</p>
          </div>
        </div>
        <div className={styles.planGrid}>
          {data.availablePlans.map((p) => (
            <article
              className={styles.plan}
              data-current={p.id === plan.id}
              key={p.id}
            >
              <div className={styles.planName}>
                <h3>{t(p.name)}</h3>
                {p.id === plan.id && (
                  <span className={styles.currentPlanBadge}>
                    {t("current")}
                  </span>
                )}
              </div>
              <p className={styles.planPrice}>
                {money(p)}
                <small>{t(p.billingInterval)}</small>
              </p>
              {p.positioning && (
                <p className={styles.positioning}>{t(p.positioning)}</p>
              )}
              <ul className={styles.planFeatures}>
                {p.quotas
                  .filter((q) => q.limit !== 0)
                  .map((q) => (
                    <li key={q.key}>
                      <Check size={16} aria-hidden="true" />
                      <span>
                        {t(`quota.${q.key}`, { count: limitLabel(q.limit) })}
                      </span>
                    </li>
                  ))}
                {p.included.map((key) => (
                  <li key={key}>
                    <Check size={16} aria-hidden="true" />
                    <span>{t(key)}</span>
                  </li>
                ))}
                {p.excluded?.map((key) => (
                  <li key={key} className={styles.unavailable}>
                    <span aria-hidden="true">—</span>
                    <span>
                      {t(key)} <span className="sr-only">{t("no")}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                variant={p.id === plan.id ? "secondary" : "outline"}
                disabled={
                  p.id === plan.id ||
                  !allowed ||
                  (p.priceCents === 0 && !canCancel)
                }
                onClick={() => review(p)}
              >
                {t(p.id === plan.id ? "current" : `choose.${p.name}`)}
              </Button>
            </article>
          ))}
        </div>
      </section>
      <section className={styles.payment} aria-labelledby="billing-payment">
        <span className={styles.paymentIcon}>
          <CreditCard size={23} />
        </span>
        <div>
          <p className={styles.eyebrow} id="billing-payment">
            {t("payment")}
          </p>
          <h2>
            {t(payment.status === "READY" ? "paymentReady" : "paymentSoon")}
          </h2>
          <p>
            {t(payment.status === "READY" ? "paymentHelp" : "paymentOffHelp")}
          </p>
          {payment.status === "READY" && payment.mode === "SANDBOX" && (
            <p>{t("testPayment")}</p>
          )}
        </div>
      </section>
      <section
        className={styles.section}
        id="billing-invoices"
        aria-labelledby="billing-invoices-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="billing-invoices-title">{t("invoices")}</h2>
            <p>{t("invoicesHelp")}</p>
          </div>
        </div>
        {data.invoices.items.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.invoiceTable}>
              <thead>
                <tr>
                  {["date", "amount", "status", "invoice"].map((k) => (
                    <th key={k}>{t(k)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.invoices.items.map((p) => (
                  <tr key={p.id}>
                    <td data-label={t("date")}>{date(p.createdAt)}</td>
                    <td data-label={t("amount")}>
                      {formatMoney(p.amountCents, p.currency, locale)}
                    </td>
                    <td data-label={t("status")}>
                      <span
                        className={styles.invoiceStatus}
                        data-paid={p.status === "SUCCEEDED"}
                      >
                        {t(p.status)}
                      </span>
                    </td>
                    <td data-label={t("invoice")}>
                      {p.invoiceUrl ? (
                        <span className="flex flex-wrap gap-2">
                          <a aria-label="Consulter la facture" className={styles.textLink} href={p.invoiceUrl} target="_blank" rel="noopener noreferrer">PDF <ArrowUpRight size={14} /></a>
                          {p.docxUrl && <a className={styles.textLink} href={p.docxUrl} target="_blank" rel="noopener noreferrer">DOCX <ArrowUpRight size={14} /></a>}
                        </span>
                      ) : (
                        <span className={styles.muted}>
                          {t("missingInvoice")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.empty}>
            <FileText size={28} />
            <h3>{t("noInvoices")}</h3>
            {isTest && <p>{t("noTestInvoices")}</p>}
          </div>
        )}
        {data.invoices.total > data.invoices.limit && (
          <div className={styles.pagination}>
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t("previous")}
            </Button>
            <span>
              {t("page")} {page} / {data.invoices.totalPages}
            </span>
            <Button
              variant="outline"
              disabled={page * data.invoices.limit >= data.invoices.total}
              onClick={() => setPage(page + 1)}
            >
              {t("next")}
            </Button>
          </div>
        )}
      </section>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !cancel.isPending && !checkout.isPending)
            setDialog(null);
        }}
      >
        <DialogContent
          dir={locale === "ar" ? "rtl" : "ltr"}
          className={`${styles.dialog} translate-x-0 translate-y-0 sm:translate-y-0`}
        >
          <DialogHeader>
            <DialogTitle>
              {t(
                dialog === "cancel"
                  ? "cancel"
                  : dialog === "plan"
                    ? "choose"
                    : "manage",
              )}
            </DialogTitle>
            <DialogDescription>
              {dialog === "cancel"
                ? t("cancelHelp", { date: end })
                : dialog === "plan"
                  ? t("changeHelp")
                  : t("plansHelp")}
            </DialogDescription>
          </DialogHeader>
          {dialog === "manage" && (
            <div className={styles.dialogBody}>
              <h3>{t(plan.name)}</h3>
              <p>
                {subscription?.canceledAt
                  ? t("cancelHelp", { date: end })
                  : `${t("periodEnd")} · ${end}`}
              </p>
              <hr />
              {canCancel ? (
                <button
                  className={styles.cancelLink}
                  onClick={() => setDialog("cancel")}
                >
                  {t("cancel")}
                </button>
              ) : (
                <a className={styles.textLink} href="/support">
                  {t("support")}
                </a>
              )}
            </div>
          )}
          {(dialog === "plan" || dialog === "cancel") && (
            <div className={styles.dialogBody}>
              {target && (
                <div className={styles.changeSummary}>
                  <strong>
                    {t(plan.name)} → {t(target.name)}
                  </strong>
                  <span>
                    {money(target)} {t(target.billingInterval)}
                  </span>
                </div>
              )}
              {!!impact?.lost.length && (
                <div>
                  <h3>{t("lost")}</h3>
                  <ul className={styles.lost}>
                    {impact.lost.map((k) => (
                      <li key={k}>{t(k)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!!impact?.exceeded.length && (
                <div className={styles.notice}>
                  <h3>{t("exceeded")}</h3>
                  {impact.exceeded.map((q) => (
                    <p key={q.key}>
                      {t(q.key)} : {q.used} / {limitLabel(q.limit)}
                    </p>
                  ))}
                  <p>{t(dialog === "cancel" ? "freeLimitHelp" : "reduce")}</p>
                </div>
              )}
              {dialog === "plan" && (
                <>
                  <p>{t("noProration")}</p>
                  {payment.status !== "READY" && (
                    <div className={styles.notice}>
                      {t("paymentSoon")}
                      <p>{t("paymentOffHelp")}</p>
                    </div>
                  )}
                  {payment.status === "READY" && payment.mode === "SANDBOX" && (
                    <p>{t("testPayment")}</p>
                  )}
                  {data.billingCycle.automaticRenewal && (
                    <p className={styles.notice}>{t("stripeHelp")}</p>
                  )}
                  <Button
                    disabled={
                      !allowed ||
                      payment.status !== "READY" ||
                      !!impact?.exceeded.length ||
                      data.billingCycle.automaticRenewal ||
                      checkout.isPending
                    }
                    onClick={() => checkout.mutate()}
                  >
                    {t(checkout.isPending ? "processing" : "checkout")}
                  </Button>
                </>
              )}
              {dialog === "cancel" && (
                <div className={styles.dialogActions}>
                  <Button
                    variant="outline"
                    disabled={cancel.isPending}
                    onClick={() => setDialog(null)}
                  >
                    {t("keep")}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!canCancel || cancel.isPending}
                    onClick={() => cancel.mutate()}
                  >
                    {t(cancel.isPending ? "processing" : "confirmCancel")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
