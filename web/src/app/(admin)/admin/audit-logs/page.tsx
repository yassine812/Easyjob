'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { PageHeader, ErrorState, PaginationControls, SkeletonRows } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatDateTime } from '@/lib/format';

export default function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');

  const logs = useQuery({
    queryKey: ['admin-audit-logs', { page, action }],
    queryFn: () =>
      adminApi.auditLogs({
        page,
        limit: 20,
        action: action || undefined,
      }),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Journal d’audit" description="Toutes les actions importantes de la plateforme.">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtrer par action (ex. auth.login)"
            className="w-80 pl-9"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </PageHeader>

      <div className="mt-8">
        {logs.isPending ? (
          <SkeletonRows rows={10} cols={5} />
        ) : logs.isError ? (
          <ErrorState message="Impossible de charger le journal d’audit." retry={() => logs.refetch()} />
        ) : logs.data && logs.data.items.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Auteur</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Objet</th>
                    <th className="px-4 py-3">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.data.items.map((l) => (
                    <tr key={l.id} className="border-t align-top">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatDateTime(l.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{l.actor?.name ?? 'Système'}</p>
                        <p className="text-xs text-muted-foreground">{l.actor?.email ?? ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {l.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {l.entityType}
                        {l.entityId ? (
                          <span className="ml-1 font-mono text-xs">({l.entityId.slice(0, 8)})</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{l.ipAddress ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={page}
              totalPages={logs.data.totalPages}
              total={logs.data.total}
              onPageChange={setPage}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune entrée d’audit trouvée.</p>
        )}
      </div>
    </div>
  );
}
