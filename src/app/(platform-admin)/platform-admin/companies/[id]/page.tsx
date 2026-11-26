'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminApi, type AdminCompanyDetail } from '@/lib/api/admin';
import { adminStatusLabel } from '@/lib/admin-labels';
import { ErrorState, PageHeader, SkeletonRows } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatMoney } from '@/lib/format';

type Tab = 'overview' | 'members' | 'subscription' | 'invoices' | 'activity';
const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Aperçu' }, { id: 'members', label: 'Membres' },
  { id: 'subscription', label: 'Abonnement' }, { id: 'invoices', label: 'Factures' },
  { id: 'activity', label: 'Activité' },
];
const planNames: Record<string, string> = { TRIAL: 'EasyJob Starter', BUSINESS: 'EasyJob Business', PRO: 'EasyJob Pro', ENTERPRISE: 'EasyJob Enterprise' };

export default function PlatformAdminCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (tabs.some(item => item.id === requested)) setTab(requested as Tab);
  }, []);
  const query = useQuery({ queryKey: ['platform-admin-company', id], queryFn: () => adminApi.company(id), enabled: Boolean(id) });
  const plans = useQuery({ queryKey: ['platform-admin-company-plans'], queryFn: () => adminApi.plans('COMPANY') });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['platform-admin-company', id] }); void queryClient.invalidateQueries({ queryKey: ['platform-admin-companies'] }); };
  const updateStatus = useMutation({ mutationFn: (next: string) => adminApi.updateCompanyStatus(id, next), onSuccess: () => { toast.success('Statut de l’entreprise mis à jour'); refresh(); }, onError: () => toast.error('Impossible de modifier cette entreprise.') });
  const updateSubscription = useMutation({ mutationFn: ({ subscriptionId, input }: { subscriptionId: string; input: { planId?: string; action?: 'cancel' | 'reactivate' } }) => adminApi.updateSubscription(subscriptionId, input), onSuccess: () => { toast.success('Abonnement mis à jour'); refresh(); }, onError: () => toast.error('Impossible de modifier cet abonnement.') });
  const extend = useMutation({ mutationFn: ({ subscriptionId, days, reason }: { subscriptionId: string; days: number; reason: string }) => adminApi.extendSubscription(subscriptionId, days, reason), onSuccess: () => { toast.success('Abonnement prolongé'); refresh(); }, onError: () => toast.error('Impossible de prolonger cet abonnement.') });

  if (query.isPending) return <SkeletonRows rows={6} cols={4} />;
  if (query.isError || !query.data) return <ErrorState message="Impossible de charger cette entreprise." retry={() => query.refetch()} />;
  const company: AdminCompanyDetail = query.data;
  const current = company.subscriptions[0];
  const prolong = () => { if (!current) return; const days = Number(window.prompt('Nombre de jours à ajouter', '30')); const reason = window.prompt('Motif obligatoire'); if (Number.isInteger(days) && days > 0 && reason?.trim()) extend.mutate({ subscriptionId: current.id, days, reason: reason.trim() }); };

  return <div className="mx-auto max-w-6xl">
    <Button variant="ghost" className="mb-4" onClick={() => router.push('/platform-admin/users?tab=companies')}>← Utilisateurs</Button>
    <PageHeader title={company.commercialName} description={`${company.legalName} · créée le ${formatDate(company.createdAt)}`}><div className="flex items-center gap-2"><Badge variant={company.status === 'ACTIVE' ? 'success' : company.status === 'SUSPENDED' ? 'destructive' : 'warning'}>{adminStatusLabel(company.status)}</Badge><Button variant="outline" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate(company.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED')}>{company.status === 'SUSPENDED' ? 'Réactiver' : 'Suspendre'}</Button></div></PageHeader>
    <div className="mt-6 flex flex-wrap gap-1 border-b">{tabs.map(item => <Button key={item.id} variant="ghost" className={tab === item.id ? 'rounded-none border-b-2 border-primary' : 'rounded-none'} onClick={() => setTab(item.id)}>{item.label}</Button>)}</div>

    {tab === 'overview' && <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Membres" value={company._count?.members ?? company.members.length} /><Metric label="Offres" value={company._count?.jobs ?? 0} /><Metric label="Candidatures" value={company.applications ?? 0} /><Metric label="Entretiens" value={company.interviews ?? 0} /></div>}

    {tab === 'members' && <section className="mt-8 rounded-xl border bg-card p-5"><h2 className="font-semibold">Équipe de l’entreprise</h2><p className="mt-1 text-sm text-muted-foreground">Les recruteurs sont rattachés à cette entreprise et ne figurent pas dans la liste principale.</p><div className="mt-4 divide-y">{company.members.length ? company.members.map(member => <div key={member.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><p className="font-medium">{member.user.name}</p><p className="text-xs text-muted-foreground">{member.user.email}</p></div><Badge variant="outline">{member.isOwner ? 'Owner · ' : ''}{member.role}</Badge></div>) : <p className="py-8 text-sm text-muted-foreground">Aucun membre.</p>}</div></section>}

    {tab === 'subscription' && <section className="mt-8 rounded-xl border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">Plan actuel</p><p className="mt-1 text-xl font-semibold">{current?.plan ? planNames[current.plan.name] ?? current.plan.name : 'EasyJob Starter'}</p>{current?.plan && <p className="text-sm text-muted-foreground">{formatMoney(current.plan.priceCents, current.plan.currency)} · {current.plan.billingInterval === 'YEARLY' ? 'annuel' : 'mensuel'}</p>}</div><Badge variant={current?.status === 'ACTIVE' ? 'success' : 'outline'}>{adminStatusLabel(current?.status ?? 'FREE')}</Badge></div>{current ? <><dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><Info label="Début" value={current.currentPeriodStart ? formatDate(current.currentPeriodStart) : '—'} /><Info label="Renouvellement / expiration" value={current.currentPeriodEnd ? formatDate(current.currentPeriodEnd) : 'Sans expiration'} /><Info label="Temps restant" value={current.remainingDays == null ? 'Sans expiration' : current.remainingDays <= 0 ? 'Expiré' : `${current.remainingDays} jours`} /><Info label="Renouvellement automatique" value={current.autoRenew ? 'Oui' : 'Non'} /></dl><div className="mt-6 flex flex-wrap gap-2"><select aria-label="Changer de plan" value={current.plan?.id ?? ''} onChange={event => event.target.value && event.target.value !== current.plan?.id && updateSubscription.mutate({ subscriptionId: current.id, input: { planId: event.target.value } })} className="h-9 rounded-md border bg-background px-3 text-sm" disabled={updateSubscription.isPending || plans.isPending}>{plans.data?.filter(plan => plan.active).map(plan => <option key={plan.id} value={plan.id}>{planNames[plan.name] ?? plan.name} · {formatMoney(plan.priceCents, plan.currency)}</option>)}</select><Button variant="outline" onClick={prolong} disabled={extend.isPending}>Prolonger l’abonnement</Button><Button variant="outline" onClick={() => updateSubscription.mutate({ subscriptionId: current.id, input: { action: current.canceledAt ? 'reactivate' : 'cancel' } })} disabled={updateSubscription.isPending}>{current.canceledAt ? 'Réactiver' : 'Annuler en fin de période'}</Button></div></> : <p className="mt-6 text-sm text-muted-foreground">EasyJob Starter est actif sans date d’expiration.</p>}</section>}

    {tab === 'invoices' && <section className="mt-8 rounded-xl border bg-card p-5"><h2 className="font-semibold">Factures</h2>{current?.payments.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Référence</th><th className="py-2">Montant</th><th className="py-2">Statut</th><th className="py-2">Date</th><th className="py-2">Documents</th></tr></thead><tbody>{current.payments.map(payment => <tr key={payment.id} className="border-t"><td className="py-3 font-mono text-xs">{payment.invoiceNumber ?? payment.providerPaymentId ?? payment.id}</td><td className="py-3">{formatMoney(payment.amountCents, payment.currency)}</td><td className="py-3"><Badge variant={payment.status === 'SUCCEEDED' ? 'success' : payment.status === 'FAILED' ? 'destructive' : 'outline'}>{adminStatusLabel(payment.status)}</Badge></td><td className="py-3 text-muted-foreground">{formatDate(payment.paidAt ?? payment.createdAt)}</td><td className="py-3">{payment.invoiceUrl ? <a className="text-primary underline" href={payment.invoiceUrl} target="_blank" rel="noreferrer">PDF</a> : '—'}{payment.docxUrl ? <a className="ml-3 text-primary underline" href={payment.docxUrl} target="_blank" rel="noreferrer">DOCX</a> : null}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-muted-foreground">Aucune facture.</p>}</section>}

    {tab === 'activity' && <section className="mt-8 rounded-xl border bg-card p-5"><h2 className="font-semibold">Dernière activité</h2><p className="mt-3 text-sm">{company.lastActivity ? adminStatusLabel(company.lastActivity.action) : 'Aucune activité enregistrée'}</p><p className="text-xs text-muted-foreground">{company.lastActivity ? formatDate(company.lastActivity.createdAt) : 'Jamais'}</p></section>}
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>; }
