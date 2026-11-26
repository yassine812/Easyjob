'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, MoreHorizontal, RotateCcw, Search, SlidersHorizontal, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type PlatformAdminCandidate, type PlatformAdminCompany } from '@/lib/api/admin';
import { usersApi } from '@/lib/api/users';
import { adminStatusLabel } from '@/lib/admin-labels';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ErrorState, PageHeader, PaginationControls } from '@/components/shared';
import { ProvisionCompany } from '@/components/admin/provision-company';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { InputWithIcon } from '@/components/ui/input-with-icon';
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Category = 'candidates' | 'companies';
type Period = 'all' | '7' | '30' | '90';
type Filters = { planId: string; subscriptionStatus: string; accountStatus: string; expiring: string; activeWithin: Period };

const emptyFilters: Filters = { planId: 'all', subscriptionStatus: 'all', accountStatus: 'all', expiring: 'all', activeWithin: 'all' };
const subscriptionStatuses = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED'] as const;
const candidatePlanNames: Record<string, string> = { FREE: 'EasyJob Start', PRO: 'EasyJob Boost', PREMIUM: 'EasyJob Max', CAREER_AI: 'EasyJob Max' };
const companyPlanNames: Record<string, string> = { TRIAL: 'EasyJob Starter', BUSINESS: 'EasyJob Business', PRO: 'EasyJob Pro', ENTERPRISE: 'EasyJob Enterprise' };
const candidatePlanShort: Record<string, string> = { FREE: 'Start', PRO: 'Boost', PREMIUM: 'Max', CAREER_AI: 'Max' };
const companyPlanShort: Record<string, string> = { TRIAL: 'Starter', BUSINESS: 'Business', PRO: 'Pro', ENTERPRISE: 'Enterprise' };

function planLabel(name: string | null | undefined, category: Category) {
  if (!name) return category === 'candidates' ? 'EasyJob Start' : 'EasyJob Starter';
  return (category === 'candidates' ? candidatePlanNames : companyPlanNames)[name] ?? name;
}

function planShort(name: string | null | undefined, category: Category) {
  if (!name) return category === 'candidates' ? 'Start' : 'Starter';
  return (category === 'candidates' ? candidatePlanShort : companyPlanShort)[name] ?? name;
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'EJ';
}

function relativeActivity(value: string | null | undefined) {
  if (!value) return 'Aucune activité';
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days === 0) return 'Aujourd’hui';
  if (days === 1) return 'Hier';
  return `Il y a ${days} jours`;
}

function remainingText(days: number | null | undefined) {
  if (days == null) return 'Sans expiration';
  if (days <= 0) return 'Expiré';
  return `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`;
}

function expirationTone(days: number | null | undefined) {
  if (days == null || days > 14) return 'text-muted-foreground';
  if (days <= 3) return 'text-destructive';
  if (days <= 7) return 'text-orange-500 dark:text-orange-400';
  return 'text-amber-600 dark:text-amber-400';
}

function PlanChip({ name, category }: { name: string | null | undefined; category: Category }) {
  const label = planShort(name, category);
  const premium = ['Max', 'Pro', 'Enterprise'].includes(label);
  const mid = ['Boost', 'Business'].includes(label);
  return <span className={cn('inline-flex max-w-full truncate rounded-full border px-2.5 py-1 text-xs font-semibold tracking-tight', premium ? 'border-violet-400/25 bg-violet-500/10 text-violet-700 dark:text-violet-300' : mid ? 'border-cyan-400/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' : 'border-border/70 bg-muted/60 text-muted-foreground')}>{label}</span>;
}

function PlanSubscriptionMeta({ name, category, status, days }: { name: string | null | undefined; category: Category; status: string | null; days: number | null | undefined }) {
  const statusLabel = status === 'FREE' || !status ? 'Gratuit' : adminStatusLabel(status);
  return <div className="min-w-0"><PlanChip name={name} category={category} /><p className={cn('mt-1.5 truncate text-xs', expirationTone(days))}>{statusLabel} · {remainingText(days)}</p></div>;
}

function RenewalMeta({ date, free, canceled, days }: { date: string | null | undefined; free: boolean; canceled?: boolean; days: number | null | undefined }) {
  return <div className="min-w-0"><p className={cn('truncate font-medium', days != null && days <= 3 && 'text-destructive')}>{free ? 'Aucun' : date ? formatDate(date) : 'Sans échéance'}</p><p className="mt-1 truncate text-xs text-muted-foreground">{free ? 'Plan gratuit' : canceled ? 'Fin de période' : 'Renouvellement auto'}</p></div>;
}

function ActivityMeta({ value }: { value: string | null | undefined }) {
  return <div className="min-w-0"><p className="truncate font-medium">{value ? formatDate(value) : 'Jamais'}</p><p className="mt-1 truncate text-xs text-muted-foreground">{relativeActivity(value)}</p></div>;
}

function AccountBadge({ status }: { status: string }) {
  if (status === 'ACTIVE') return null;
  return <Badge variant={status === 'SUSPENDED' ? 'destructive' : 'warning'} className="mt-1.5 max-w-full truncate">{adminStatusLabel(status)}</Badge>;
}

function Identity({ name, email, createdAt, company = false, status, secondary, activation }: { name: string; email?: string | null; createdAt?: string; company?: boolean; status?: string; secondary?: string; activation?: string }) {
  return <div className="flex min-w-0 items-center gap-3"><Avatar size="lg" className={company ? 'shrink-0 rounded-xl' : 'shrink-0'}><AvatarFallback className={cn('font-semibold', company ? 'rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' : 'bg-violet-500/10 text-violet-700 dark:text-violet-300')}>{initials(name)}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate font-semibold text-foreground" title={name}>{name}</p>{email && <p className="truncate text-xs text-muted-foreground" title={email}>{email}</p>}{createdAt && <p className="mt-0.5 truncate text-[11px] text-muted-foreground/75">Inscrit le {formatDate(createdAt)}</p>}{secondary && <p className="mt-0.5 truncate text-[11px] text-muted-foreground min-[1400px]:hidden">{secondary}</p>}{activation && <p className={cn('mt-0.5 truncate text-[11px]', activation === 'Compte activé' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>{activation}</p>}{status && <AccountBadge status={status} />}</div></div>;
}

function CandidateActions({ candidate }: { candidate: PlatformAdminCandidate }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const detail = `/platform-admin/users/candidates/${candidate.id}`;
  const updateStatus = useMutation({ mutationFn: () => usersApi.adminUpdate(candidate.id, { status: candidate.accountStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }), onSuccess: () => { toast.success(candidate.accountStatus === 'ACTIVE' ? 'Compte suspendu' : 'Compte réactivé'); void queryClient.invalidateQueries({ queryKey: ['platform-admin-candidates'] }); }, onError: () => toast.error('Impossible de modifier ce compte.') });
  return <div className="flex shrink-0 justify-end gap-1" onClick={event => event.stopPropagation()}><Button size="sm" variant="outline" onClick={() => router.push(detail)}>Ouvrir</Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`Actions pour ${candidate.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56"><DropdownMenuItem onSelect={() => router.push(`${detail}?tab=subscription`)}>Voir l’abonnement</DropdownMenuItem><DropdownMenuItem onSelect={() => router.push(`${detail}?tab=invoices`)}>Voir les factures</DropdownMenuItem><DropdownMenuItem onSelect={() => router.push(detail)}>Modifier</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant={candidate.accountStatus === 'ACTIVE' ? 'destructive' : 'default'} disabled={updateStatus.isPending} onSelect={() => updateStatus.mutate()}>{candidate.accountStatus === 'ACTIVE' ? 'Suspendre' : 'Réactiver'}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>;
}

function CompanyActions({ company }: { company: PlatformAdminCompany }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const detail = `/platform-admin/users/companies/${company.id}`;
  const updateStatus = useMutation({ mutationFn: () => adminApi.updateCompanyStatus(company.id, company.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'), onSuccess: () => { toast.success(company.status === 'SUSPENDED' ? 'Entreprise réactivée' : 'Entreprise suspendue'); void queryClient.invalidateQueries({ queryKey: ['platform-admin-companies'] }); }, onError: () => toast.error('Impossible de modifier cette entreprise.') });
  const resend = useMutation({ mutationFn: () => adminApi.resendCompanyInvitation(company.id), onSuccess: () => { toast.success('Invitation renvoyée'); void queryClient.invalidateQueries({ queryKey: ['platform-admin-companies'] }); }, onError: error => toast.error(error instanceof Error ? error.message : 'Impossible de renvoyer l’invitation.') });
  return <div className="flex shrink-0 justify-end gap-1" onClick={event => event.stopPropagation()}><Button size="sm" variant="outline" onClick={() => router.push(detail)}>Ouvrir</Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`Actions pour ${company.commercialName}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56"><DropdownMenuItem onSelect={() => router.push(`${detail}?tab=subscription`)}>Voir l’abonnement</DropdownMenuItem><DropdownMenuItem onSelect={() => router.push(`${detail}?tab=invoices`)}>Voir les factures</DropdownMenuItem><DropdownMenuItem onSelect={() => router.push(detail)}>Modifier</DropdownMenuItem>{company.owner?.mustChangePassword && <DropdownMenuItem disabled={resend.isPending} onSelect={() => resend.mutate()}>Renvoyer l’invitation</DropdownMenuItem>}<DropdownMenuSeparator /><DropdownMenuItem variant={company.status === 'ACTIVE' ? 'destructive' : 'default'} disabled={updateStatus.isPending} onSelect={() => updateStatus.mutate()}>{company.status === 'SUSPENDED' ? 'Réactiver' : 'Suspendre'}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>;
}

export function UsersCenter() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>('candidates');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => { if (new URLSearchParams(window.location.search).get('tab') === 'companies') setCategory('companies'); }, []);
  const resetFilters = () => { setSearch(''); setFilters(emptyFilters); setDraftFilters(emptyFilters); setPage(1); };
  const changeCategory = (value: string) => { const next = value as Category; setCategory(next); resetFilters(); router.replace(`/platform-admin/users${next === 'companies' ? '?tab=companies' : ''}`, { scroll: false }); };

  const plans = useQuery({ queryKey: ['platform-admin-plans', category], queryFn: () => adminApi.plans(category === 'candidates' ? 'CANDIDATE' : 'COMPANY') });
  const candidateCount = useQuery({ queryKey: ['platform-admin-candidates-count'], queryFn: () => adminApi.candidates({ page: 1, limit: 1 }) });
  const companyCount = useQuery({ queryKey: ['platform-admin-companies-count'], queryFn: () => adminApi.companies({ page: 1, limit: 1 }) });
  const common = { page, limit: pageSize, search: deferredSearch || undefined, planId: filters.planId === 'all' ? undefined : filters.planId, subscriptionStatus: filters.subscriptionStatus === 'all' ? undefined : filters.subscriptionStatus, expiring: filters.expiring === 'all' ? undefined : filters.expiring as '7' | '30', activeWithin: filters.activeWithin === 'all' ? undefined : filters.activeWithin };
  const candidates = useQuery({ queryKey: ['platform-admin-candidates', common, filters.accountStatus], queryFn: () => adminApi.candidates({ ...common, status: filters.accountStatus === 'all' ? undefined : filters.accountStatus }), enabled: category === 'candidates' });
  const companies = useQuery({ queryKey: ['platform-admin-companies', common, filters.accountStatus], queryFn: () => adminApi.companies({ ...common, status: filters.accountStatus === 'all' ? undefined : filters.accountStatus }), enabled: category === 'companies' });
  const active = category === 'candidates' ? candidates : companies;
  const activeFilterEntries = Object.entries(filters).filter(([, value]) => value !== 'all') as Array<[keyof Filters, string]>;

  const openFilters = (open: boolean) => { setFiltersOpen(open); if (open) setDraftFilters(filters); };
  const applyFilters = () => { setFilters(draftFilters); setPage(1); setFiltersOpen(false); };
  const clearAppliedFilter = (key: keyof Filters) => { setFilters(current => ({ ...current, [key]: 'all' })); setPage(1); };
  const filterLabel = (key: keyof Filters, value: string) => {
    if (key === 'planId') return plans.data?.find(plan => plan.id === value)?.name ? planLabel(plans.data.find(plan => plan.id === value)?.name, category) : 'Plan';
    if (key === 'accountStatus' || key === 'subscriptionStatus') return adminStatusLabel(value);
    if (key === 'expiring') return `Expire sous ${value} jours`;
    return `Actif depuis ${value} jours`;
  };

  return <div className="mx-auto min-w-0 max-w-[1500px]">
    <PageHeader title="Utilisateurs" description="Gérez les comptes candidats et entreprises de la plateforme." />
    <Tabs value={category} onValueChange={changeCategory} className="mt-5"><TabsList className="h-10 w-auto rounded-xl bg-muted/55 p-1"><TabsTrigger value="candidates" className="w-auto gap-2 rounded-lg px-3 data-[state=active]:shadow-sm"><UserRound className="size-4" />Candidats <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">{candidateCount.data?.total ?? '…'}</span></TabsTrigger><TabsTrigger value="companies" className="w-auto gap-2 rounded-lg px-3 data-[state=active]:shadow-sm"><Building2 className="size-4" />Entreprises <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">{companyCount.data?.total ?? '…'}</span></TabsTrigger></TabsList></Tabs>

    {category === 'companies' && <ProvisionCompany compact onCreated={() => void companyCount.refetch()} />}

    <div className="mt-5 flex min-w-0 items-center gap-2"><div className="relative min-w-0 flex-1"><InputWithIcon icon={<Search className="size-4" />} aria-label={category === 'candidates' ? 'Rechercher nom ou email' : 'Rechercher nom d’entreprise ou owner'} placeholder={category === 'candidates' ? 'Rechercher nom ou email…' : 'Rechercher entreprise ou owner…'} className="h-10 bg-card/55" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div><Popover open={filtersOpen} onOpenChange={openFilters}><PopoverTrigger asChild><Button variant="outline" className="h-10 shrink-0 gap-2 bg-card/55"><SlidersHorizontal className="size-4" />Filtres{activeFilterEntries.length > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">{activeFilterEntries.length}</span>}</Button></PopoverTrigger><PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] gap-4 p-4"><PopoverHeader><PopoverTitle>Filtres</PopoverTitle><PopoverDescription>Affinez les comptes affichés.</PopoverDescription></PopoverHeader><FilterSelect label="Plan" value={draftFilters.planId} onChange={value => setDraftFilters(current => ({ ...current, planId: value }))} options={[{ value: 'all', label: 'Tous les plans' }, ...(plans.data?.filter(plan => plan.active).map(plan => ({ value: plan.id, label: planLabel(plan.name, category) })) ?? [])]} /><FilterSelect label={category === 'companies' ? 'Statut entreprise' : 'Statut du compte'} value={draftFilters.accountStatus} onChange={value => setDraftFilters(current => ({ ...current, accountStatus: value }))} options={[{ value: 'all', label: 'Tous les statuts' }, { value: 'ACTIVE', label: 'Actif' }, { value: 'SUSPENDED', label: 'Suspendu' }, ...(category === 'companies' ? [{ value: 'PENDING_VERIFICATION', label: 'À vérifier' }] : [])]} /><FilterSelect label="Statut abonnement" value={draftFilters.subscriptionStatus} onChange={value => setDraftFilters(current => ({ ...current, subscriptionStatus: value }))} options={[{ value: 'all', label: 'Tous les abonnements' }, ...subscriptionStatuses.map(status => ({ value: status, label: adminStatusLabel(status) }))]} /><FilterSelect label="Expiration" value={draftFilters.expiring} onChange={value => setDraftFilters(current => ({ ...current, expiring: value }))} options={[{ value: 'all', label: 'Toute expiration' }, { value: '7', label: 'Sous 7 jours' }, { value: '30', label: 'Sous 30 jours' }]} /><FilterSelect label="Dernière activité" value={draftFilters.activeWithin} onChange={value => setDraftFilters(current => ({ ...current, activeWithin: value as Period }))} options={periodOptions('Actifs')} /><div className="flex items-center justify-between gap-2 border-t pt-3"><Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setDraftFilters(emptyFilters)}><RotateCcw className="size-3.5" />Réinitialiser</Button><Button size="sm" onClick={applyFilters}>Appliquer</Button></div></PopoverContent></Popover></div>

    {activeFilterEntries.length > 0 && <div className="mt-3 flex flex-wrap gap-2" aria-label="Filtres actifs">{activeFilterEntries.map(([key, value]) => <button key={key} type="button" className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10" onClick={() => clearAppliedFilter(key)}>{filterLabel(key, value)}<X className="size-3" /></button>)}<button type="button" className="px-1 text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={resetFilters}>Tout effacer</button></div>}

    <div className="mt-4 min-w-0">{active.isPending ? <PremiumSkeleton /> : active.isError ? <ErrorState message={`Impossible de charger les ${category === 'candidates' ? 'candidats' : 'entreprises'}.`} retry={() => active.refetch()} /> : category === 'candidates' ? <CandidateList data={candidates.data} reset={resetFilters} /> : <CompanyList data={companies.data} reset={resetFilters} />}{active.data && <PaginationControls page={page} totalPages={active.data.totalPages} total={active.data.total} pageSize={pageSize} onPageSizeChange={value => { setPageSize(value); setPage(1); }} onPageChange={setPage} />}</div>
  </div>;
}

function CandidateList({ data, reset }: { data: Awaited<ReturnType<typeof adminApi.candidates>> | undefined; reset: () => void }) {
  const router = useRouter();
  if (!data?.items.length) return <EmptyState label="Aucun candidat trouvé" reset={reset} />;
  const columns = 'grid-cols-[minmax(0,2.15fr)_minmax(0,1.5fr)_minmax(0,1.35fr)_minmax(0,.95fr)_auto]';
  return <><div data-users-list className="hidden min-w-0 rounded-2xl border border-border/60 bg-card/70 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.7)] min-[1100px]:block"><div className={cn('grid items-center gap-3 border-b border-border/50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground', columns)}><span>Candidat</span><span>Plan & abonnement</span><span>Renouvellement</span><span>Activité</span><span className="text-right">Actions</span></div><div className="divide-y divide-border/40">{data.items.map(candidate => <div key={candidate.id} role="button" tabIndex={0} className={cn('grid min-w-0 cursor-pointer items-center gap-3 px-5 py-4 text-sm outline-none transition-colors hover:bg-primary/[.035] focus-visible:bg-primary/[.05]', columns)} onClick={() => router.push(`/platform-admin/users/candidates/${candidate.id}`)} onKeyDown={event => { if (event.key === 'Enter') router.push(`/platform-admin/users/candidates/${candidate.id}`); }}><Identity name={candidate.name} email={candidate.email} createdAt={candidate.createdAt} status={candidate.accountStatus} /><PlanSubscriptionMeta name={candidate.plan?.name} category="candidates" status={candidate.subscriptionStatus} days={candidate.daysRemaining} /><RenewalMeta date={candidate.expiresAt} free={candidate.subscriptionStatus === 'FREE'} canceled={Boolean(candidate.subscription?.canceledAt)} days={candidate.daysRemaining} /><ActivityMeta value={candidate.lastActivityAt} /><CandidateActions candidate={candidate} /></div>)}</div></div><div className="grid gap-3 min-[1100px]:hidden">{data.items.map(candidate => <article key={candidate.id} className="min-w-0 rounded-2xl border border-border/60 bg-card/75 p-4 shadow-sm"><Identity name={candidate.name} email={candidate.email} createdAt={candidate.createdAt} status={candidate.accountStatus} /><div className="mt-4"><PlanSubscriptionMeta name={candidate.plan?.name} category="candidates" status={candidate.subscriptionStatus} days={candidate.daysRemaining} /></div><div className="mt-4 grid min-w-0 grid-cols-2 gap-3 rounded-xl bg-muted/35 p-3 text-sm"><div className="min-w-0"><p className="mb-1 text-xs text-muted-foreground">Renouvellement</p><RenewalMeta date={candidate.expiresAt} free={candidate.subscriptionStatus === 'FREE'} canceled={Boolean(candidate.subscription?.canceledAt)} days={candidate.daysRemaining} /></div><div className="min-w-0"><p className="mb-1 text-xs text-muted-foreground">Activité</p><ActivityMeta value={candidate.lastActivityAt} /></div></div><div className="mt-4"><CandidateActions candidate={candidate} /></div></article>)}</div></>;
}

function CompanyList({ data, reset }: { data: Awaited<ReturnType<typeof adminApi.companies>> | undefined; reset: () => void }) {
  const router = useRouter();
  if (!data?.items.length) return <EmptyState label="Aucune entreprise trouvée" reset={reset} />;
  const columns = 'grid-cols-[minmax(0,2.1fr)_minmax(0,1.45fr)_minmax(0,1.3fr)_minmax(0,.9fr)_auto] min-[1400px]:grid-cols-[minmax(0,2.1fr)_minmax(0,1.35fr)_minmax(0,1.15fr)_minmax(0,1.25fr)_minmax(0,.9fr)_auto]';
  return <><div data-users-list className="hidden min-w-0 rounded-2xl border border-border/60 bg-card/70 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.7)] min-[1100px]:block"><div className={cn('grid items-center gap-3 border-b border-border/50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground', columns)}><span>Entreprise / owner</span><span>Plan & abonnement</span><span className="hidden min-[1400px]:block">Équipe</span><span>Renouvellement</span><span>Activité</span><span className="text-right">Actions</span></div><div className="divide-y divide-border/40">{data.items.map(company => { const memberCount = company._count?.members ?? 0; const team = `${memberCount} membre${memberCount > 1 ? 's' : ''}${company.owner?.name ? ` · Owner : ${company.owner.name}` : ''}`; const activation = company.owner?.mustChangePassword ? 'Invitation envoyée' : 'Compte activé'; return <div key={company.id} role="button" tabIndex={0} className={cn('grid min-w-0 cursor-pointer items-center gap-3 px-5 py-4 text-sm outline-none transition-colors hover:bg-primary/[.035] focus-visible:bg-primary/[.05]', columns)} onClick={() => router.push(`/platform-admin/users/companies/${company.id}`)} onKeyDown={event => { if (event.key === 'Enter') router.push(`/platform-admin/users/companies/${company.id}`); }}><Identity name={company.commercialName} email={company.owner?.email ?? company.legalName} createdAt={company.createdAt} company status={company.status} secondary={team} activation={activation} /><PlanSubscriptionMeta name={company.plan?.name} category="companies" status={company.subscriptionStatus} days={company.subscription?.remainingDays} /><div className="hidden min-w-0 min-[1400px]:block"><p className="truncate font-semibold tabular-nums">{memberCount} membre{memberCount > 1 ? 's' : ''}</p><p className="mt-1 truncate text-xs text-muted-foreground" title={company.owner?.name ? `Owner : ${company.owner.name}` : undefined}>{company.owner?.name ? `Owner : ${company.owner.name}` : 'Aucun owner'}</p></div><RenewalMeta date={company.subscription?.currentPeriodEnd} free={company.subscriptionStatus === 'FREE'} days={company.subscription?.remainingDays} /><ActivityMeta value={company.lastActivityAt} /><CompanyActions company={company} /></div>; })}</div></div><div className="grid gap-3 min-[1100px]:hidden">{data.items.map(company => { const memberCount = company._count?.members ?? 0; const activation = company.owner?.mustChangePassword ? 'Invitation envoyée' : 'Compte activé'; return <article key={company.id} className="min-w-0 rounded-2xl border border-border/60 bg-card/75 p-4 shadow-sm"><Identity name={company.commercialName} email={company.owner?.email ?? company.legalName} createdAt={company.createdAt} company status={company.status} activation={activation} /><div className="mt-4"><PlanSubscriptionMeta name={company.plan?.name} category="companies" status={company.subscriptionStatus} days={company.subscription?.remainingDays} /></div><div className="mt-4 grid min-w-0 grid-cols-2 gap-3 rounded-xl bg-muted/35 p-3 text-sm"><div className="min-w-0"><p className="text-xs text-muted-foreground">Équipe</p><p className="mt-1 truncate font-semibold">{memberCount} membre{memberCount > 1 ? 's' : ''}</p><p className="mt-1 truncate text-xs text-muted-foreground">{company.owner?.name ? `Owner : ${company.owner.name}` : 'Aucun owner'}</p></div><div className="min-w-0"><p className="mb-1 text-xs text-muted-foreground">Renouvellement</p><RenewalMeta date={company.subscription?.currentPeriodEnd} free={company.subscriptionStatus === 'FREE'} days={company.subscription?.remainingDays} /></div></div><div className="mt-3"><ActivityMeta value={company.lastActivityAt} /></div><div className="mt-4"><CompanyActions company={company} /></div></article>; })}</div></>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <div className="space-y-1.5"><p className="text-xs font-medium text-muted-foreground">{label}</p><Select value={value} onValueChange={onChange}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
}

function periodOptions(prefix: string) {
  return [{ value: 'all', label: 'Toutes les dates' }, { value: '7', label: `${prefix} ces 7 derniers jours` }, { value: '30', label: `${prefix} ces 30 derniers jours` }, { value: '90', label: `${prefix} ces 90 derniers jours` }];
}

function EmptyState({ label, reset }: { label: string; reset: () => void }) {
  return <div className="rounded-2xl border border-dashed border-border/70 bg-card/45 px-6 py-14 text-center"><div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-muted"><Search className="size-5 text-muted-foreground" /></div><p className="mt-4 font-semibold">{label}</p><p className="mt-1 text-sm text-muted-foreground">Modifiez votre recherche ou réinitialisez les filtres.</p><Button variant="outline" size="sm" className="mt-4 gap-2" onClick={reset}><RotateCcw className="size-3.5" />Réinitialiser les filtres</Button></div>;
}

function PremiumSkeleton() {
  return <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60"><div className="flex h-12 items-center gap-6 border-b border-border/50 px-5"><Skeleton className="h-3 w-40" /><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-24" /></div>{Array.from({ length: 7 }, (_, index) => <div key={index} className="flex h-[76px] items-center gap-4 border-b border-border/35 px-5 last:border-0"><Skeleton className="size-10 rounded-full" /><div className="w-56 space-y-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-48" /></div><Skeleton className="ml-auto h-7 w-20 rounded-full" /><Skeleton className="h-8 w-28" /></div>)}</div>;
}
