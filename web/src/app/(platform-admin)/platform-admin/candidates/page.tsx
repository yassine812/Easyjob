'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, UserRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { ErrorState, PageHeader, PaginationControls, SkeletonRows } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatDate, formatMoney } from '@/lib/format';

export default function PlatformAdminCandidatesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const candidates = useQuery({ queryKey: ['platform-admin-candidates', { page, search }], queryFn: () => adminApi.candidates({ page, limit: 20, search: search || undefined }) });
  return <div className="mx-auto max-w-6xl">
    <PageHeader title="Candidats" description="Les comptes individuels et leurs abonnements EasyJob.">
      <div className="relative"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Rechercher un candidat" placeholder="Nom ou e-mail" className="w-64 pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
    </PageHeader>
    <div className="mt-8">{candidates.isPending ? <SkeletonRows rows={8} cols={8} /> : candidates.isError ? <ErrorState message="Impossible de charger les candidats." retry={() => candidates.refetch()} /> : candidates.data?.items.length ? <>
      <div className="overflow-hidden rounded-xl border bg-card"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Candidat</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Statut abonnement</th><th className="px-4 py-3">Inscription</th><th className="px-4 py-3">Dernière activité</th><th className="px-4 py-3">Expiration</th><th className="px-4 py-3">Temps restant</th><th className="px-4 py-3">Compte</th></tr></thead><tbody>{candidates.data.items.map(candidate => <tr key={candidate.id} className="border-t"><td className="px-4 py-3"><Link href={`/platform-admin/candidates/${candidate.id}`} className="flex items-center gap-2 font-medium hover:text-primary"><UserRound className="size-4 text-muted-foreground" />{candidate.name}</Link><p className="pl-6 text-xs text-muted-foreground">{candidate.email}</p></td><td className="px-4 py-3">{candidate.plan ? <><p>{candidate.plan.name}</p><p className="text-xs text-muted-foreground">{formatMoney(candidate.plan.priceCents, candidate.plan.currency)}</p></> : '—'}</td><td className="px-4 py-3"><Badge variant={candidate.subscriptionStatus === 'ACTIVE' ? 'success' : candidate.subscriptionStatus ? 'warning' : 'outline'}>{candidate.subscriptionStatus ?? 'Aucun'}</Badge></td><td className="px-4 py-3 text-muted-foreground">{formatDate(candidate.createdAt)}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(candidate.lastActivityAt)}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(candidate.expiresAt)}</td><td className="px-4 py-3">{candidate.daysRemaining == null ? '—' : candidate.daysRemaining === 0 ? <Badge variant="destructive">Expiré</Badge> : <Badge variant={candidate.daysRemaining <= 7 ? 'warning' : 'success'}>{candidate.daysRemaining} j</Badge>}</td><td className="px-4 py-3"><Badge variant={candidate.accountStatus === 'ACTIVE' ? 'success' : 'destructive'}>{candidate.accountStatus}</Badge></td></tr>)}</tbody></table></div>
      <PaginationControls page={page} totalPages={candidates.data.totalPages} total={candidates.data.total} onPageChange={setPage} />
    </> : <p className="text-sm text-muted-foreground">Aucun candidat trouvé.</p>}</div>
  </div>;
}
