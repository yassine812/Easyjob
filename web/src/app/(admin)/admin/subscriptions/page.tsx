'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { PageHeader, ErrorState, PaginationControls, SkeletonRows } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { SUBSCRIPTION_STATUS_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/format';

export default function AdminSubscriptionsPage() {
  const [page, setPage] = useState(1);

  const subscriptions = useQuery({
    queryKey: ['admin-subscriptions', { page }],
    queryFn: () => adminApi.subscriptions({ page, limit: 20 }),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Subscriptions" description="All plan subscriptions on the platform." />
      <div className="mt-8">
        {subscriptions.isPending ? (
          <SkeletonRows rows={8} cols={5} />
        ) : subscriptions.isError ? (
          <ErrorState message="Could not load subscriptions." retry={() => subscriptions.refetch()} />
        ) : subscriptions.data && subscriptions.data.items.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.data.items.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="px-4 py-3">
                        <p className="font-medium">{s.owner?.name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{s.owner?.email ?? ''}</p>
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
                          {SUBSCRIPTION_STATUS_LABELS[s.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(s.currentPeriodStart)} — {formatDate(s.currentPeriodEnd)}
                      </td>
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
          <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
        )}
      </div>
    </div>
  );
}
