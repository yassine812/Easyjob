'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, BarChart3, Building2, BriefcaseBusiness, CreditCard, FileWarning, LifeBuoy, RefreshCw, Users } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminApi, type PlatformAdminDashboard } from '@/lib/api/admin';
import { PageHeader, SkeletonRows, ErrorState } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatMoney } from '@/lib/format';
import { adminStatusLabel } from '@/lib/admin-labels';

const emptyDashboard: PlatformAdminDashboard = {
  metrics: { activeCompanies: 0, newCompanies: 0, previousNewCompanies: 0, activeUsers: 0, activeCandidates: 0, activeJobs: 0, paidSubscriptions: 0, openTickets: 0, pendingCompanies: 0, failedPayments: 0, failedJobs: 0, expiringUnder7Days: 0, expiringUnder30Days: 0 },
  financial: { available: false, message: 'Paiement non configuré' },
  actionCenter: { failedPayments: 0, pendingCompanies: 0, urgentTickets: 0, failedJobs: 0 },
  growth: [], planDistribution: [], recentCompanies: [], recentActivity: [],
};

function number(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function normalizeDashboard(value: unknown): PlatformAdminDashboard {
  if (!value || typeof value !== 'object') return emptyDashboard;
  const source = value as Partial<PlatformAdminDashboard>;
  const metrics = { ...emptyDashboard.metrics, ...(source.metrics ?? {}) };
  const actionCenter = { ...emptyDashboard.actionCenter, ...(source.actionCenter ?? {}) };
  return {
    ...emptyDashboard,
    ...source,
    metrics: Object.fromEntries(Object.entries(metrics).map(([key, item]) => [key, number(item)])) as PlatformAdminDashboard['metrics'],
    actionCenter: Object.fromEntries(Object.entries(actionCenter).map(([key, item]) => [key, number(item)])) as PlatformAdminDashboard['actionCenter'],
    financial: source.financial && typeof source.financial === 'object' ? source.financial : emptyDashboard.financial,
    growth: Array.isArray(source.growth) ? source.growth : [],
    planDistribution: Array.isArray(source.planDistribution) ? source.planDistribution : [],
    recentCompanies: Array.isArray(source.recentCompanies) ? source.recentCompanies : [],
    recentActivity: Array.isArray(source.recentActivity) ? source.recentActivity : [],
  };
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (!previous && !current) return null;
  const delta = current - previous;
  return <span className={delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{delta >= 0 ? '+' : ''}{delta} ce mois</span>;
}

export default function AdminDashboardPage() {
  const pathname = usePathname();
  const base = pathname.startsWith('/platform-admin') ? '/platform-admin' : '/admin';
  const dashboard = useQuery({ queryKey: ['platform-admin-dashboard'], queryFn: adminApi.dashboard, staleTime: 60_000 });
  const health = useQuery({ queryKey: ['platform-admin-health'], queryFn: adminApi.systemHealth, staleTime: 30_000 });

  if (dashboard.isPending) return <SkeletonRows rows={6} cols={4} />;
  if (dashboard.isError) return <ErrorState message="Impossible de charger les métriques de la plateforme." retry={() => dashboard.refetch()} />;
  const d = normalizeDashboard(dashboard.data);
  const m = d.metrics;
  const growth = d.growth ?? [];
  const mrr = d.financial.mrrByCurrencyCents ? Object.entries(d.financial.mrrByCurrencyCents) : [];
  const revenue = d.financial.periodRevenueByCurrencyCents ? Object.entries(d.financial.periodRevenueByCurrencyCents) : [];
  const attention = [
    { label: 'Entreprises en attente', value: d.actionCenter.pendingCompanies, href: `${base}/companies`, icon: Building2 },
    { label: 'Paiements échoués', value: d.actionCenter.failedPayments, href: `${base}/invoices`, icon: CreditCard },
    { label: 'Expirent sous 7 jours', value: d.actionCenter.expiringUnder7Days ?? 0, href: `${base}/subscriptions`, icon: CreditCard },
    { label: 'Tickets urgents', value: d.actionCenter.urgentTickets, href: `${base}/support`, icon: LifeBuoy },
    { label: 'Jobs en échec', value: d.actionCenter.failedJobs ?? 0, href: `${base}/system`, icon: FileWarning },
  ];
  const kpis = [
    { label: 'Entreprises actives', value: m.activeCompanies, hint: <Delta current={m.newCompanies} previous={m.previousNewCompanies ?? 0} />, href: `${base}/companies`, icon: Building2, tone: 'text-violet-600' },
    { label: 'Utilisateurs actifs', value: m.activeUsers ?? m.activeCandidates, hint: 'Comptes activés', href: `${base}/users`, icon: Users, tone: 'text-sky-600' },
    { label: 'Offres actives', value: m.activeJobs, hint: 'Publiées ou approuvées', href: `${base}/jobs`, icon: BriefcaseBusiness, tone: 'text-amber-600' },
    { label: 'Abonnements payants', value: m.paidSubscriptions, hint: d.financial.available ? 'Fournisseur configuré' : 'Paiement non configuré', href: `${base}/subscriptions`, icon: CreditCard, tone: 'text-emerald-600' },
    { label: 'Expirent sous 7 jours', value: m.expiringUnder7Days ?? 0, hint: `${m.expiringUnder30Days ?? 0} sous 30 jours`, href: `${base}/subscriptions`, icon: CreditCard, tone: 'text-orange-600' },
  ];
  const secondaryCards: Array<{ label: string; value: ReactNode; hint: string; icon: typeof BarChart3 }> = [
    { label: 'MRR', value: d.financial.available && mrr.length ? mrr.map(([currency, cents]) => formatMoney(cents, currency)).join(' · ') : '—', hint: d.financial.available ? 'Abonnements actifs' : 'Paiement non configuré', icon: BarChart3 },
    { label: 'Factures impayées', value: m.failedPayments, hint: 'Paiements échoués', icon: CreditCard },
    { label: 'Tickets ouverts', value: m.openTickets, hint: 'À traiter par le support', icon: LifeBuoy },
    { label: 'Jobs en échec', value: m.failedJobs ?? 0, hint: 'Synchronisations récentes', icon: FileWarning },
  ];

  return <div className="mx-auto max-w-7xl space-y-6">
    <PageHeader title="Vue d’ensemble" description="Santé, croissance et opérations de la plateforme EasyJob.">
      <div className="flex items-center gap-2"><span className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">30 derniers jours</span><Button variant="outline" size="sm" onClick={() => { void dashboard.refetch(); void health.refetch(); }}><RefreshCw className="mr-2 size-4" />Actualiser</Button></div>
    </PageHeader>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map((kpi) => <Link key={kpi.label} href={kpi.href} className="group"><Card className="h-full transition-shadow hover:shadow-md"><CardContent className="relative overflow-hidden p-5"><div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/60 to-transparent" /><div className="flex items-start justify-between"><div className={`rounded-xl bg-muted p-2.5 ${kpi.tone}`}><kpi.icon className="size-5" /></div><span className="text-xs text-muted-foreground">Voir</span></div><p className="mt-4 text-3xl font-semibold tracking-tight">{kpi.value}</p><p className="mt-1 text-sm font-medium">{kpi.label}</p><p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p></CardContent></Card></Link>)}</section>

    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{secondaryCards.map(({ label, value, hint, icon: Icon }) => <Card key={label}><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4" />{label}</div><p className="mt-3 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></CardContent></Card>)}</section>

    <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <Card><CardHeader><CardTitle>Croissance plateforme</CardTitle><p className="text-sm text-muted-foreground">Nouveaux enregistrements calculés depuis la base.</p></CardHeader><CardContent className="h-72">{growth.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={growth}><defs><linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.28} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="period" /><YAxis allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="companies" name="Entreprises" stroke="hsl(var(--primary))" fill="url(#growth-fill)" strokeWidth={2} /><Area type="monotone" dataKey="candidates" name="Candidats" stroke="hsl(var(--chart-2))" fill="transparent" strokeWidth={2} /><Area type="monotone" dataKey="jobs" name="Offres" stroke="hsl(var(--chart-3))" fill="transparent" strokeWidth={2} /></AreaChart></ResponsiveContainer> : <Empty text="Aucune croissance enregistrée sur la période." />}</CardContent></Card>
      <Card><CardHeader><CardTitle>À traiter</CardTitle></CardHeader><CardContent className="space-y-2">{attention.map((item) => <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"><span className="flex items-center gap-2"><item.icon className="size-4 text-muted-foreground" />{item.label}</span><span className="flex items-center gap-2 font-semibold">{item.value}<span className="text-muted-foreground">Voir</span></span></Link>)}</CardContent></Card>
    </section>

    <section className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Répartition des abonnements</CardTitle></CardHeader><CardContent className="space-y-5"><PlanDistribution title="Entreprises" plans={d.planDistribution} /><PlanDistribution title="Candidats" plans={d.candidatePlanDistribution} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Santé de la plateforme</CardTitle></CardHeader><CardContent>{health.isPending ? <SkeletonRows rows={4} cols={2} /> : health.isError ? <Empty text="État des services indisponible." /> : <div className="grid gap-2 sm:grid-cols-2">{Object.entries((health.data as { services?: Record<string, unknown> }).services ?? {}).map(([name, value]) => { const raw = value && typeof value === 'object' ? (value as Record<string, unknown>).status ?? (value as Record<string, unknown>).state : value; const healthy = raw === 'up' || raw === 'healthy' || raw === 'connected'; return <div key={name} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"><span className="capitalize">{name.replaceAll('_', ' ')}</span><Badge variant={healthy ? 'success' : 'warning'}>{adminStatusLabel(raw)}</Badge></div>; })}</div>}</CardContent></Card>
    </section>

    <section className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><div className="flex items-center justify-between"><CardTitle>Dernières entreprises</CardTitle><Link className="text-sm text-primary hover:underline" href={`${base}/companies`}>Voir toutes</Link></div></CardHeader><CardContent>{d.recentCompanies?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="pb-2">Entreprise</th><th className="pb-2">Plan</th><th className="pb-2">Statut</th><th className="pb-2">Créée le</th></tr></thead><tbody>{d.recentCompanies.map((company) => <tr key={company.id} className="border-t"><td className="py-3 font-medium">{company.commercialName}</td><td className="py-3 text-muted-foreground">{company.plan ?? '—'}</td><td className="py-3"><Badge variant="outline">{adminStatusLabel(company.status)}</Badge></td><td className="py-3 text-muted-foreground">{formatDate(company.createdAt)}</td></tr>)}</tbody></table></div> : <Empty text="Aucune entreprise." />}</CardContent></Card>
      <Card><CardHeader><CardTitle>Activité récente</CardTitle></CardHeader><CardContent>{d.recentActivity?.length ? <div className="space-y-3">{d.recentActivity.map((entry) => <div key={entry.id} className="flex gap-3 text-sm"><Activity className="mt-0.5 size-4 shrink-0 text-primary" /><div><p>{activityLabel(entry.action, entry.entityType)}</p><p className="text-xs text-muted-foreground">{entry.actorName ?? 'Système'} · {formatDate(entry.createdAt)}</p></div></div>)}</div> : <Empty text="Aucune activité récente." />}</CardContent></Card>
    </section>
    {d.financial.available && revenue.length ? <p className="text-xs text-muted-foreground">Revenus encaissés sur la période : {revenue.map(([currency, cents]) => formatMoney(cents, currency)).join(' · ')}</p> : null}
  </div>;
}

function Empty({ text }: { text: string }) { return <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground"><AlertCircle className="mr-2 size-4" />{text}</div>; }
function PlanDistribution({ title, plans }: { title: string; plans?: Array<{ name: string; count: number; percentage: number }> }) { return <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>{plans?.length ? <div className="space-y-3">{plans.map(plan => <div key={plan.name} className="space-y-1"><div className="flex justify-between text-sm"><span>{plan.name}</span><span className="text-muted-foreground">{plan.count} · {plan.percentage}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, number(plan.percentage))}%` }} /></div></div>)}</div> : <p className="text-sm text-muted-foreground">Aucun abonnement actif.</p>}</div>; }
function activityLabel(action: string, entityType: string) {
  const key = `${entityType}:${action}`.toLowerCase();
  if (key.includes('company') && key.includes('creat')) return 'Entreprise créée';
  if (key.includes('plan')) return 'Plan modifié';
  if (key.includes('user') && key.includes('suspend')) return 'Utilisateur suspendu';
  if (key.includes('ticket') && key.includes('resolv')) return 'Ticket résolu';
  return `${entityType} · ${action}`;
}
