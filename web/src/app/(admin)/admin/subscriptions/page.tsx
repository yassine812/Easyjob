'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { PageHeader, ErrorState, PaginationControls, SkeletonRows } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { adminStatusLabel } from '@/lib/admin-labels';
import { formatDate } from '@/lib/format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminSubscriptionsPage() {
  const [page, setPage] = useState(1);
  const [ownerType, setOwnerType] = useState('all');
  const [status, setStatus] = useState('all');
  const [expiring, setExpiring] = useState('all');

  const subscriptions = useQuery({
    queryKey: ['admin-subscriptions', { page, ownerType, status, expiring }],
    queryFn: () => adminApi.subscriptions({ page, limit: 20, ownerType: ownerType === 'all' ? undefined : ownerType as 'COMPANY' | 'CANDIDATE', status: status === 'all' ? undefined : status, expiring: expiring === 'all' ? undefined : expiring as '7' | '30' }),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Abonnements" description="Tous les abonnements de la plateforme."><div className="flex flex-wrap gap-2"><Select value={ownerType} onValueChange={v => { setOwnerType(v); setPage(1); }}><SelectTrigger className="w-36"><SelectValue placeholder="Audience" /></SelectTrigger><SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="COMPANY">Entreprises</SelectItem><SelectItem value="CANDIDATE">Candidats</SelectItem></SelectContent></Select><Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}><SelectTrigger className="w-36"><SelectValue placeholder="Statut" /></SelectTrigger><SelectContent><SelectItem value="all">Tous les statuts</SelectItem><SelectItem value="ACTIVE">Actif</SelectItem><SelectItem value="TRIALING">Essai</SelectItem><SelectItem value="PAST_DUE">Impayé</SelectItem><SelectItem value="EXPIRED">Expiré</SelectItem></SelectContent></Select><Select value={expiring} onValueChange={v => { setExpiring(v); setPage(1); }}><SelectTrigger className="w-36"><SelectValue placeholder="Expiration" /></SelectTrigger><SelectContent><SelectItem value="all">Toutes les dates</SelectItem><SelectItem value="7">Sous 7 jours</SelectItem><SelectItem value="30">Sous 30 jours</SelectItem></SelectContent></Select></div></PageHeader>
      <div className="mt-8">
        {subscriptions.isPending ? (
          <SkeletonRows rows={8} cols={5} />
        ) : subscriptions.isError ? (
          <ErrorState message="Impossible de charger les abonnements." retry={() => subscriptions.refetch()} />
        ) : subscriptions.data && subscriptions.data.items.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Propriétaire</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Période</th>
                    <th className="px-4 py-3">Temps restant</th>
                    <th className="px-4 py-3">Renouvellement</th>
                    <th className="px-4 py-3">Créé le</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.data.items.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="px-4 py-3">
                        <p className="font-medium">{s.owner?.name ?? s.candidate?.user.name ?? s.company?.commercialName ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{s.owner?.email ?? s.candidate?.user.email ?? ''}</p>
                      </td>
                      <td className="px-4 py-3">{s.plan?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{s.ownerType}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            s.status === 'ACTIVE'
                              ? 'success'
                              : ['PAST_DUE', 'EXPIRED'].includes(s.status)
                                ? 'destructive'
                                : 'warning'
                          }
                        >
                          {adminStatusLabel(s.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(s.currentPeriodStart)} — {formatDate(s.currentPeriodEnd)}
                      </td>
                      <td className="px-4 py-3">{s.remainingDays == null ? '—' : s.remainingDays <= 0 ? <Badge variant="destructive">Expiré</Badge> : <Badge variant={s.remainingDays <= 7 ? 'warning' : 'success'}>{s.remainingDays} j</Badge>}</td>
                      <td className="px-4 py-3">{s.autoRenew ? <Badge variant="success">Auto</Badge> : <Badge variant="outline">Manuel</Badge>}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={page}
              totalPages={subscriptions.data.totalPages}
              total={subscriptions.data.total}
              onPageChange={setPage}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun abonnement pour le moment.</p>
        )}
      </div>
    </div>
  );
}
