'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api/admin';
import { ErrorState, PageHeader, SkeletonRows } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatMoney } from '@/lib/format';
import { adminStatusLabel } from '@/lib/admin-labels';

type Tab = 'overview' | 'subscription' | 'invoices' | 'activity';
const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Aperçu' }, { id: 'subscription', label: 'Abonnement' },
  { id: 'invoices', label: 'Factures' }, { id: 'activity', label: 'Activité' },
];
const candidatePlanNames: Record<string, string> = { FREE: 'EasyJob Start', PRO: 'EasyJob Boost', PREMIUM: 'EasyJob Max', CAREER_AI: 'EasyJob Max' };

export default function PlatformAdminCandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (tabs.some(item => item.id === requested)) setTab(requested as Tab);
  }, []);
  const query = useQuery({ queryKey: ['platform-admin-candidate', id], queryFn: () => adminApi.candidate(id), enabled: Boolean(id) });
  const plans = useQuery({ queryKey: ['platform-admin-candidate-plans'], queryFn: () => adminApi.plans('CANDIDATE') });
  const subscription = useMutation({ mutationFn: ({ subscriptionId, planId }: { subscriptionId: string; planId: string }) => adminApi.updateSubscription(subscriptionId, { planId }), onSuccess: () => { toast.success('Plan mis à jour'); void queryClient.invalidateQueries({ queryKey: ['platform-admin-candidate', id] }); }, onError: () => toast.error('Impossible de changer le plan.') });
  const extend = useMutation({ mutationFn: ({ subscriptionId, days, reason }: { subscriptionId: string; days: number; reason: string }) => adminApi.extendSubscription(subscriptionId, days, reason), onSuccess: () => { toast.success('Abonnement prolongé'); void queryClient.invalidateQueries({ queryKey: ['platform-admin-candidate', id] }); }, onError: () => toast.error('Impossible de prolonger l’abonnement.') });

  if (query.isPending) return <SkeletonRows rows={6} cols={4} />;
  if (query.isError || !query.data) return <ErrorState message="Impossible de charger ce candidat." retry={() => query.refetch()} />;
  const candidate = query.data;
  const current = candidate.subscriptions[0];
  const planName = current?.plan?.name ?? candidate.plan?.name ?? 'FREE';
  const prolong = () => { if (!current) return; const days = Number(window.prompt('Nombre de jours à ajouter', '30')); const reason = window.prompt('Motif obligatoire'); if (Number.isInteger(days) && days > 0 && reason?.trim()) extend.mutate({ subscriptionId: current.id, days, reason: reason.trim() }); };

  return <div className="mx-auto max-w-6xl">
    <Button variant="ghost" className="mb-4" onClick={() => router.push('/platform-admin/users')}>← Utilisateurs</Button>
    <PageHeader title={candidate.name} description={`${candidate.email} · inscrit le ${formatDate(candidate.createdAt)}`}><Badge variant={candidate.accountStatus === 'ACTIVE' ? 'success' : 'destructive'}>{adminStatusLabel(candidate.accountStatus)}</Badge></PageHeader>
    <div className="mt-6 flex flex-wrap gap-1 border-b">{tabs.map(item => <Button key={item.id} variant="ghost" className={tab === item.id ? 'rounded-none border-b-2 border-primary' : 'rounded-none'} onClick={() => setTab(item.id)}>{item.label}</Button>)}</div>

    {tab === 'overview' && <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Profil complété" value={candidate.candidateProfile?.headline || candidate.candidateProfile?.bio ? 'Oui' : 'À compléter'} /><Metric label="Candidatures" value={candidate.candidateProfile?.applications ?? 0} /><Metric label="CV" value={candidate.candidateProfile?.resumes ?? 0} /><Metric label="Dernière activité" value={candidate.lastActivityAt ? formatDate(candidate.lastActivityAt) : 'Jamais'} /></div>}

    {tab === 'subscription' && <section className="mt-8 rounded-xl border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">Plan actuel</p><p className="mt-1 text-xl font-semibold">{candidatePlanNames[planName] ?? planName}</p>{current?.plan && <p className="text-sm text-muted-foreground">{formatMoney(current.plan.priceCents, current.plan.currency)} · {current.plan.billingInterval === 'YEARLY' ? 'annuel' : 'mensuel'}</p>}</div><Badge variant={current?.status === 'ACTIVE' ? 'success' : 'outline'}>{adminStatusLabel(current?.status ?? 'FREE')}</Badge></div>{current ? <><dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><Info label="Début" value={formatDate(current.currentPeriodStart)} /><Info label="Renouvellement / expiration" value={formatDate(current.currentPeriodEnd)} /><Info label="Temps restant" value={current.remainingDays == null ? 'Sans expiration' : current.remainingDays <= 0 ? 'Expiré' : `${current.remainingDays} jours`} /><Info label="Renouvellement automatique" value={current.autoRenew ? 'Oui' : 'Non'} /></dl><div className="mt-6 flex flex-wrap gap-2"><select aria-label="Changer de plan" value={current.plan?.id ?? ''} onChange={event => event.target.value && subscription.mutate({ subscriptionId: current.id, planId: event.target.value })} className="h-9 rounded-md border bg-background px-3 text-sm" disabled={subscription.isPending}>{plans.data?.filter(plan => plan.active).map(plan => <option key={plan.id} value={plan.id}>{candidatePlanNames[plan.name] ?? plan.name}</option>)}</select><Button variant="outline" onClick={prolong} disabled={extend.isPending}>Prolonger l’abonnement</Button></div></> : <p className="mt-6 text-sm text-muted-foreground">EasyJob Start est actif sans date d’expiration.</p>}</section>}

    {tab === 'invoices' && <section className="mt-8 rounded-xl border bg-card p-5"><h2 className="font-semibold">Factures</h2>{current?.payments.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Référence</th><th className="py-2">Montant</th><th className="py-2">Statut</th><th className="py-2">Date</th></tr></thead><tbody>{current.payments.map(payment => <tr key={payment.id} className="border-t"><td className="py-3">{payment.providerPaymentId ?? payment.id}</td><td className="py-3">{formatMoney(payment.amountCents, payment.currency)}</td><td className="py-3"><Badge variant={payment.status === 'SUCCEEDED' ? 'success' : 'outline'}>{adminStatusLabel(payment.status)}</Badge></td><td className="py-3 text-muted-foreground">{formatDate(payment.paidAt ?? payment.createdAt)}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-muted-foreground">Aucune facture.</p>}</section>}

    {tab === 'activity' && <section className="mt-8 rounded-xl border bg-card p-5"><h2 className="font-semibold">Dernière activité</h2><p className="mt-3 text-sm">{candidate.activity ? adminStatusLabel(candidate.activity.action) : 'Aucune activité enregistrée'}</p><p className="text-xs text-muted-foreground">{candidate.lastActivityAt ? formatDate(candidate.lastActivityAt) : 'Jamais'}</p></section>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>; }
