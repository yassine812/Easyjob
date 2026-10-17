'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { ErrorState, PageHeader, SkeletonRows } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatMoney } from '@/lib/format';

export default function PlatformAdminCandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const query = useQuery({ queryKey: ['platform-admin-candidate', id], queryFn: () => adminApi.candidate(id), enabled: Boolean(id) });
  if (query.isPending) return <SkeletonRows rows={6} cols={4} />;
  if (query.isError || !query.data) return <ErrorState message="Impossible de charger ce candidat." retry={() => query.refetch()} />;
  const candidate = query.data;
  const current = candidate.subscriptions[0];
  return <div className="mx-auto max-w-6xl"><Button variant="ghost" className="mb-4" onClick={() => router.push('/platform-admin/candidates')}>← Candidats</Button><PageHeader title={candidate.name} description={`${candidate.email} · inscrit le ${formatDate(candidate.createdAt)}`}><Badge variant={candidate.accountStatus === 'ACTIVE' ? 'success' : 'destructive'}>{candidate.accountStatus}</Badge></PageHeader>
    <div className="mt-6 flex gap-1 border-b"><Button variant="ghost" className="rounded-none border-b-2 border-primary">Aperçu</Button><Button variant="ghost" className="rounded-none">Abonnement</Button><Button variant="ghost" className="rounded-none">Factures</Button><Button variant="ghost" className="rounded-none">Activité</Button></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Profil complété</p><p className="mt-2 text-2xl font-semibold">{candidate.candidateProfile?.headline || candidate.candidateProfile?.bio ? 'Oui' : 'À compléter'}</p></div><div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Applications</p><p className="mt-2 text-2xl font-semibold">{candidate.candidateProfile?.applications ?? 0}</p></div><div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">CV</p><p className="mt-2 text-2xl font-semibold">{candidate.candidateProfile?.resumes ?? 0}</p></div><div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Dernière activité</p><p className="mt-2 text-sm font-semibold">{formatDate(candidate.lastActivityAt)}</p></div></div>
    <section className="mt-8 rounded-xl border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">Abonnement candidat</p><p className="mt-1 text-xl font-semibold">{current?.plan?.name ?? 'Aucun abonnement'}</p>{current?.plan && <p className="text-sm text-muted-foreground">{formatMoney(current.plan.priceCents, current.plan.currency)} · {current.plan.billingInterval === 'YEARLY' ? 'annuel' : 'mensuel'}</p>}</div><Badge variant={current?.status === 'ACTIVE' ? 'success' : 'outline'}>{current?.status ?? '—'}</Badge></div>{current && <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-muted-foreground">Début</dt><dd className="font-medium">{formatDate(current.currentPeriodStart)}</dd></div><div><dt className="text-muted-foreground">Renouvellement / expiration</dt><dd className="font-medium">{formatDate(current.currentPeriodEnd)}</dd></div><div><dt className="text-muted-foreground">Jours restants</dt><dd className="font-medium">{current.remainingDays ?? '—'}</dd></div><div><dt className="text-muted-foreground">Auto-renew</dt><dd className="font-medium">{current.autoRenew ? 'Oui' : 'Non'}</dd></div></dl>}</section>
    <section className="mt-8 rounded-xl border bg-card p-5"><h2 className="font-semibold">Factures</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Référence</th><th className="py-2">Montant</th><th className="py-2">Statut</th><th className="py-2">Date</th></tr></thead><tbody>{current?.payments.map(payment => <tr key={payment.id} className="border-t"><td className="py-3">{payment.providerPaymentId ?? payment.id}</td><td className="py-3">{formatMoney(payment.amountCents, payment.currency)}</td><td className="py-3"><Badge variant={payment.status === 'SUCCEEDED' ? 'success' : 'outline'}>{payment.status}</Badge></td><td className="py-3 text-muted-foreground">{formatDate(payment.paidAt ?? payment.createdAt)}</td></tr>)}</tbody></table></div></section>
  </div>;
}
