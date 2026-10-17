'use client';

import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Check, Minus } from 'lucide-react';
import { billingApi } from '@/lib/api/billing';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared';
import { formatMoney } from '@/lib/format';
import type { Plan } from '@/types/api';
import { useI18n } from '@/lib/i18n';
import { useProductText } from '@/lib/i18n/product';
import { useCareerText } from '@/lib/i18n/career';

function featureLabel(key: string): string {
  switch (key) {
    case 'cv.uploads':
      return 'CV uploads';
    case 'applications':
      return 'Applications';
    case 'team.members':
      return 'Team members';
    case 'activeJobs':
      return 'Active jobs';
    case 'ai.enabled':
      return 'AI recruitment tools';
    case 'ai.cv_analyze':
      return 'AI CV analysis';
    case 'ai.cv_generate':
      return 'AI CV generation';
    case 'ai.match':
      return 'AI job matching';
    case 'ai.cover_letter':
      return 'AI cover letters';
    case 'ai.interview':
      return 'AI interview questions';
    case 'automation.enabled':
      return 'Automation';
    case 'assessments.enabled':
      return 'Assessments';
    case 'analytics.enabled':
      return 'Analytics';
    case 'billing.manage':
      return 'Billing management';
    default:
      return key.replace(/_/g, ' ');
  }
}

function featureIncluded(value: unknown): boolean {
  if (typeof value === 'number') return value > 0;
  return value === true;
}

type CompanyGroup = { label: string; items: string[] };

function companyGroups(plan: Plan, tx: (key: string) => string): CompanyGroup[] {
  const f = plan.features as Record<string, unknown>;
  const groups: CompanyGroup[] = [
    { label: tx('companyRecruitment'), items: [tx('companyCoreHiring')] },
  ];
  if (Number(f.activeJobs) > 3 || Number(f['team.members']) > 5 || f['advanced.search'] === true) {
    groups[0].items.push(tx('companyAdvancedSearch'));
  }
  if (f['ai.enabled'] === true) {
    groups.push({ label: tx('companyAi'), items: [tx('companyAiMatching')] });
    const quota = Number(f['ai.analyses.monthly'] ?? 0);
    if (quota > 0) groups[1].items.push(`${tx('companyAiAnalyses')}: ${quota}`);
  }
  if (f['analytics.enabled'] === true) groups.push({ label: tx('companyAnalytics'), items: [tx('companyKpis')] });
  if (f['automation.enabled'] === true) groups.push({ label: tx('companyAutomation'), items: [tx('companyWorkflows')] });
  if (f['assessments.enabled'] === true) groups.push({ label: tx('companyAssessments'), items: [tx('companyTechnicalAssessments')] });
  if (f['interviews.enabled'] === true) groups.push({ label: tx('companyInterviews'), items: [tx('companyInterviewTools')] });
  if (f['advanced.permissions'] === true || f['audit.logs'] === true) groups.push({ label: tx('companyTeamSecurity'), items: [tx('companyEnterpriseSecurity')] });
  return groups;
}

function companySummary(planName: string, tx: (key: string) => string): string {
  return tx({ TRIAL: 'companyTrialSummary', BUSINESS: 'companyBusinessSummary', PRO: 'companyProSummary', ENTERPRISE: 'companyEnterpriseSummary' }[planName] ?? 'companyBusinessSummary');
}

function formatCompanyMoney(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'TND', currencyDisplay: 'code',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(cents / 100);
}

function CompanyPlanCard({ plan, highlight, locale, tx }: { plan: Plan; highlight?: boolean; locale: string; tx: (key: string) => string }) {
  const groups = companyGroups(plan, tx);
  const limits = plan.features as Record<string, unknown>;
  return (
    <article className={`relative flex flex-col rounded-2xl border p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${highlight ? 'border-primary bg-card ring-1 ring-primary/30' : 'bg-card'}`}>
      {highlight ? <Badge className="absolute -top-3 start-1/2 -translate-x-1/2">{tx('mostPopular')}</Badge> : null}
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{plan.name}</h3><p className="mt-1 text-sm text-muted-foreground">{companySummary(plan.name, tx)}</p></div>{plan.priceCents === 0 ? <Badge variant="secondary">{tx('companyIncluded')}</Badge> : null}</div>
      <p className="mt-5 text-3xl font-semibold tracking-tight">{formatCompanyMoney(plan.priceCents, locale)}<span className="ms-1 text-sm font-normal text-muted-foreground">{plan.name === 'TRIAL' ? `/ ${tx('companyTrialPeriod')}` : `/ ${locale === 'fr' ? 'mois' : locale === 'ar' ? 'شهرياً' : 'month'}`}</span></p>
      <div className="mt-5 grid grid-cols-2 gap-2 text-xs"><span className="rounded-lg bg-muted/60 px-3 py-2">{tx('companyActiveJobs')} · <strong>{String(limits.activeJobs ?? '—')}</strong></span><span className="rounded-lg bg-muted/60 px-3 py-2">{tx('companyTeamMembers')} · <strong>{String(limits['team.members'] ?? '—')}</strong></span></div>
      <div className="mt-6 flex-1 space-y-4">{groups.map(group => <section key={group.label}><h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h4><ul className="space-y-2">{group.items.map(item => <li key={item} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-emerald-500" /><span>{item}</span></li>)}</ul></section>)}</div>
      <Button asChild variant={highlight ? 'default' : 'outline'} className="mt-7 w-full"><a href="/register">{tx('choosePlan')} {plan.name}</a></Button>
    </article>
  );
}

function PlanCard({ plan, highlight }: { plan: Plan; highlight?: boolean }) {
  const t = useCareerText();
  const displayName = plan.displayName ?? ({ FREE: 'EasyJob Start', PRO: 'EasyJob Boost', PREMIUM: 'EasyJob Max', CAREER_AI: 'EasyJob Max' } as Record<string, string>)[plan.name] ?? plan.name;
  const f = plan.features ?? {};
  const entries = ([
    ['job_search', 'planFeatureJobSearch', f.job_search], ['tracking', 'planFeatureTracking', f.tracking],
    ['cv_limit', 'planFeatureCvs', f.cv_limit ?? f['cv.uploads']], ['basic_ats', 'planFeatureBasicAts', f.basic_ats],
    ['advanced_ats', 'planFeatureAdvancedAts', f.advanced_ats], ['cv_tailoring', 'planFeatureTailoring', f.cv_tailoring],
    ['detailed_matching', 'planFeatureMatching', f.detailed_matching], ['interview_preparation', 'planFeatureInterview', f.interview_preparation],
    ['advanced_analytics', 'planFeatureAnalytics', f.advanced_analytics], ['email_alerts', 'planFeatureAlerts', f.email_alerts],
    ['auto_apply', 'planFeatureAutoApply', f.auto_apply], ['coding_interview', 'planFeatureCoding', f.coding_interview],
    ['adaptive_interview', 'planFeatureAdaptive', f.adaptive_interview],
  ] as Array<[string, string, unknown]>).filter(([, , value]) => typeof value === 'number' ? value > 0 : value === true);
  return (
    <div
      className={
        highlight
          ? 'relative flex flex-col rounded-2xl border-2 border-primary bg-card p-6 shadow-lg'
          : 'flex flex-col rounded-2xl border bg-card p-6 shadow-sm'
      }
    >
      {highlight ? <Badge className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5"><BadgeCheck className="size-3.5" aria-hidden="true" />{t('mostPopular')}</Badge> : displayName === 'EasyJob Max' ? <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" variant="secondary">Maximum AI assistance</Badge> : null}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{displayName}</h3>
        {plan.priceCents === 0 ? <Badge variant="secondary">EasyJob Start</Badge> : null}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">
        {formatMoney(plan.priceCents, plan.currency)}
        <span className="text-sm font-normal text-muted-foreground">
          {plan.billingInterval === 'MONTHLY' ? '/month' : '/year'}
        </span>
      </p>
      <ul className="mt-6 flex-1 space-y-3">
        {entries.map(([key, label, value]) => (
          <li key={key} className="flex items-start gap-2 text-sm">
            {featureIncluded(value) ? (
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            ) : (
              <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
            )}
            <span className="text-muted-foreground">
              {t(label)}
              {typeof value === 'number' ? (
                <span className="font-medium text-foreground"> · {value}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <Button asChild variant={highlight ? 'default' : 'outline'} className="mt-6">
        <a href="/register">Choose {displayName}</a>
      </Button>
    </div>
  );
}

export default function PricingPage() {
  const { locale } = useI18n();
  const tx = useProductText();
  const candidates = useQuery({
    queryKey: ['plans', 'CANDIDATE'],
    queryFn: () => billingApi.plans('CANDIDATE'),
  });
  const companies = useQuery({
    queryKey: ['plans', 'COMPANY'],
    queryFn: () => billingApi.plans('COMPANY'),
  });

  if (candidates.isPending || companies.isPending) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Skeleton className="mx-auto h-10 w-64" />
        <Skeleton className="mx-auto mt-4 h-5 w-96 max-w-full" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (candidates.isError || companies.isError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <ErrorState
          title="Could not load pricing"
          message="Please check that the API is reachable and try again."
          retry={() => {
            candidates.refetch();
            companies.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Simple, honest pricing</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Candidates start free. Companies start with a free trial — upgrade when you grow.
        </p>
      </div>

      <h2 className="mt-14 text-xl font-semibold">For candidates</h2>
      <div className="mt-5 grid gap-6 md:grid-cols-3">
        {candidates.data?.map((p) => <PlanCard key={p.id} plan={p} highlight={p.name === 'PRO'} />)}
      </div>

      <h2 className="mt-14 text-xl font-semibold">{tx('companyPricingTitle')}</h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">{tx('companyPricingBody')}</p>
      <div className="mt-5 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {companies.data?.map((p) => <CompanyPlanCard key={p.id} plan={p} locale={locale} tx={tx} highlight={p.name === 'PRO'} />)}
      </div>
    </div>
  );
}
