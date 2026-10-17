'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { PageHeader, ErrorState, SkeletonRows } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { adminStatusLabel } from '@/lib/admin-labels';
type HealthPayload = { status?: string; details?: Record<string, unknown>; services?: Record<string, unknown> };
export default function PlatformAdminSystemPage() {
  const query = useQuery({ queryKey: ['platform-admin-system-health'], queryFn: () => api.get<HealthPayload>('/platform-admin/system/health'), staleTime: 30_000, refetchInterval: 30_000 });
  if (query.isPending) return <SkeletonRows rows={5} cols={3} />;
  if (query.isError || !query.data) return <ErrorState message="Impossible de charger la santé du système." retry={() => query.refetch()} />;
  const checks = Object.entries(query.data.details ?? query.data.services ?? query.data).filter(([key]) => key !== 'status');
  return <div className="mx-auto max-w-5xl"><PageHeader title="Santé du système" description="État réel des services EasyJob et d’Agent Reach." /><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{checks.map(([name, value]) => { const objectValue = value && typeof value === 'object' ? value as Record<string, unknown> : null; const status = String(objectValue?.status ?? objectValue?.state ?? value ?? 'UNKNOWN'); const healthy = ['up','healthy','connected'].includes(status.toLowerCase()); return <div key={name} className="rounded-xl border bg-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-medium capitalize">{name.replaceAll('_',' ')}</h2><Badge variant={healthy ? 'success' : 'warning'}>{adminStatusLabel(status)}</Badge></div><p className="mt-3 text-xs text-muted-foreground">{objectValue ? Object.entries(objectValue).map(([key, entry]) => `${key.replaceAll('_', ' ')} : ${String(entry)}`).join(' · ') : ''}</p></div>; })}</div></div>;
}
