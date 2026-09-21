'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { companiesApi } from '@/lib/api/companies';
import { invitationsApi } from '@/lib/api/invitations';
import { useRole } from '@/hooks/use-auth';
import { useCompanyText } from '@/lib/i18n/company';
import { Button } from '@/components/ui/button';
import { TeamInvite } from './workspace-settings';
import { WorkspaceError, WorkspaceLoading } from './workspace-overview';
import { selectClass } from './workspace-interviews';
export function WorkspaceTeam() {
  const { companyId } = useParams<{ companyId: string }>(); const t = useCompanyText(); const { can } = useRole(); const qc = useQueryClient(); const [removeId, setRemoveId] = useState<string | null>(null);
  const members = useQuery({ queryKey: ['company-members', companyId], queryFn: () => companiesApi.members(companyId) });
  const invitations = useQuery({ queryKey: ['company-invitations', companyId], queryFn: () => invitationsApi.list(companyId), enabled: can(companyId, 'team.invite') });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['company-members', companyId] }); void qc.invalidateQueries({ queryKey: ['company-invitations', companyId] }); toast.success(t('saved')); };
  const role = useMutation({ mutationFn: ({ id, role }: { id: string; role: string }) => companiesApi.updateMember(companyId, id, role), onSuccess: refresh, onError: () => toast.error(t('saveError')) });
  const remove = useMutation({ mutationFn: (id: string) => companiesApi.removeMember(companyId, id), onSuccess: () => { setRemoveId(null); refresh(); }, onError: () => toast.error(t('saveError')) });
  const revoke = useMutation({ mutationFn: (id: string) => invitationsApi.revoke(companyId, id), onSuccess: refresh, onError: () => toast.error(t('saveError')) });
  const roleLabel = (value: string) => t(value === 'HR' ? 'HR_MANAGER' : value);
  return <div className="mx-auto max-w-5xl space-y-6"><h1 className="text-2xl font-semibold">{t('team')}</h1>{members.isPending ? <WorkspaceLoading /> : members.isError ? <WorkspaceError retry={() => void members.refetch()} /> : <section className="rounded-lg border bg-background p-5">{members.data.map(member => <article key={member.id} className="flex flex-wrap items-center justify-between gap-4 border-b py-4 last:border-0"><div><h2 className="font-medium">{member.name}</h2><p className="text-sm text-muted-foreground">{member.email}</p></div><div className="flex flex-wrap items-center gap-2">{member.isOwner ? <span className="rounded bg-primary/10 px-3 py-1 text-sm text-primary">{t('owner')}</span> : can(companyId, 'team.manage') ? <><select aria-label={`${t('role')} · ${member.name}`} className={selectClass + ' w-auto'} value={member.role} disabled={role.isPending} onChange={e => role.mutate({ id: member.id, role: e.target.value })}>{['COMPANY_ADMIN', 'HR', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER'].map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}</select><Button variant="ghost" onClick={() => setRemoveId(member.id)}>{t('remove')}</Button></> : <span className="text-sm">{roleLabel(member.role)}</span>}</div>{removeId === member.id && <div className="flex w-full flex-wrap items-center gap-3 rounded border border-destructive/30 p-3"><span className="text-sm">{t('removeMemberConfirm')}</span><Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(member.id)}>{t('confirm')}</Button><Button variant="ghost" onClick={() => setRemoveId(null)}>{t('cancel')}</Button></div>}</article>)}</section>}{can(companyId, 'team.invite') && <section className="rounded-lg border bg-background p-5"><TeamInvite companyId={companyId} /></section>}{invitations.isError && <WorkspaceError retry={() => void invitations.refetch()} />}{invitations.data && <section className="rounded-lg border bg-background p-5"><h2 className="mb-4 font-semibold">{t('pendingInvitations')}</h2>{invitations.data.length ? invitations.data.map(invitation => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 text-sm"><div>{invitation.email}<small className="block text-muted-foreground">{roleLabel(invitation.role)} · {t(invitation.status)}</small></div>{invitation.status === 'PENDING' && <Button variant="ghost" disabled={revoke.isPending} onClick={() => revoke.mutate(invitation.id)}>{t('cancel')}</Button>}</div>) : <p className="text-sm text-muted-foreground">{t('empty')}</p>}</section>}</div>;
}
