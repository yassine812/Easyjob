'use client';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { ErrorState, PageHeader, SkeletonRows } from '@/components/shared';
import { Badge } from '@/components/ui/badge';

export default function PlatformAdminNotificationsPage() {
  const query = useQuery({ queryKey: ['platform-admin-notifications'], queryFn: () => adminApi.notifications({ limit: 100 }) });
  if (query.isPending) return <SkeletonRows rows={8} cols={5} />;
  if (query.isError || !query.data) return <ErrorState message="Impossible de charger les notifications." retry={() => query.refetch()} />;
  return <div className="mx-auto max-w-7xl"><PageHeader title="Notifications" description="Suivi centralisé des notifications in-app et des événements envoyés aux utilisateurs." /><div className="mt-6 overflow-x-auto rounded-xl border bg-card"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Destinataire</th><th className="px-4 py-3">Message</th><th className="px-4 py-3">Canal</th><th className="px-4 py-3">Date</th></tr></thead><tbody className="divide-y">{query.data.items.map(notification => <tr key={notification.id}><td className="px-4 py-3"><Badge variant="outline">{notification.type}</Badge></td><td className="px-4 py-3"><p className="font-medium">{notification.user.name}</p><p className="text-xs text-muted-foreground">{notification.user.email}</p></td><td className="max-w-md px-4 py-3"><p className="font-medium">{notification.title}</p><p className="truncate text-xs text-muted-foreground">{notification.message ?? '—'}</p></td><td className="px-4 py-3"><Badge variant="secondary">In-app</Badge></td><td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Date(notification.createdAt).toLocaleString('fr-FR')}</td></tr>)}</tbody></table>{!query.data.items.length && <p className="p-10 text-center text-sm text-muted-foreground">Aucune notification.</p>}</div></div>;
}
