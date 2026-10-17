'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, type PlatformAdminPlan } from '@/lib/api/admin';
import { PageHeader, ErrorState, SkeletonRows } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';

function featureEntries(features: Record<string, unknown>) { return Object.entries(features ?? {}).filter(([, value]) => value === true || typeof value === 'number' || typeof value === 'string').slice(0, 8); }

export default function PlatformAdminPlansPage() {
  const [type, setType] = useState<'COMPANY' | 'CANDIDATE'>('COMPANY');
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['platform-admin-plans', type], queryFn: () => adminApi.plans(type) });
  const status = useMutation({ mutationFn: ({ plan, active }: { plan: PlatformAdminPlan; active: boolean }) => adminApi.updatePlanStatus(plan.id, active), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-admin-plans'] }) });
  const plans = useMemo(() => query.data ?? [], [query.data]);
  if (query.isPending) return <SkeletonRows rows={4} cols={5} />;
  if (query.isError) return <ErrorState message="Impossible de charger les plans." retry={() => query.refetch()} />;
  return <div className="mx-auto max-w-7xl"><PageHeader title="Plans" description="Catalogue des formules entreprise et candidat, avec leurs fonctionnalités et abonnés." /><div className="mt-6 flex gap-2 border-b" role="tablist" aria-label="Audience des plans">{(['COMPANY', 'CANDIDATE'] as const).map(value => <Button key={value} type="button" variant={type === value ? 'default' : 'ghost'} className="rounded-b-none" onClick={() => setType(value)}>{value === 'COMPANY' ? 'Entreprises' : 'Candidats'}</Button>)}</div><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{plans.map(plan => <PlanCard key={plan.id} plan={plan} busy={status.isPending} onToggle={() => status.mutate({ plan, active: !plan.active })} />)}{!plans.length && <p className="col-span-full rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Aucun plan pour cette audience.</p>}</div></div>;
}

function PlanCard({ plan, busy, onToggle }: { plan: PlatformAdminPlan; busy: boolean; onToggle: () => void }) { return <article className="rounded-xl border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{plan.type === 'COMPANY' ? 'Entreprise' : 'Candidat'}</p><h2 className="mt-1 font-semibold">{plan.name}</h2></div><Badge variant={plan.active ? 'success' : 'outline'}>{plan.active ? 'Actif' : 'Désactivé'}</Badge></div><p className="mt-5 text-2xl font-semibold">{formatMoney(plan.priceCents, plan.currency)}<span className="text-xs font-normal text-muted-foreground"> / {plan.billingInterval === 'MONTHLY' ? 'mois' : 'an'}</span></p><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-muted-foreground">Abonnés</p><p className="font-medium">{plan._count?.subscriptions ?? 0}</p></div><div><p className="text-muted-foreground">Mis à jour</p><p className="font-medium">{new Date(plan.updatedAt).toLocaleDateString('fr-FR')}</p></div></div><div className="mt-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fonctionnalités et quotas</p><ul className="mt-2 space-y-1 text-sm">{featureEntries(plan.features).map(([key, value]) => <li key={key} className="flex justify-between gap-3"><span className="truncate">{key.replaceAll('_', ' ')}</span><span className="font-medium">{String(value)}</span></li>)}{!featureEntries(plan.features).length && <li className="text-muted-foreground">Aucune fonctionnalité déclarée.</li>}</ul></div><Button className="mt-5 w-full" variant={plan.active ? 'outline' : 'default'} disabled={busy} onClick={onToggle}>{plan.active ? 'Désactiver le plan' : 'Activer le plan'}</Button></article>; }
