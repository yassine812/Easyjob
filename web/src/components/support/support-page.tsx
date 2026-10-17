'use client';
import { EasyJobLoading } from '@/components/ui/easyjob-loader';

import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, FileText, Loader2, Paperclip, Plus, RefreshCw, Search, Send, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputWithIcon } from '@/components/ui/input-with-icon';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supportApi, type SupportCategory } from '@/lib/api/support';
import { useSupportText } from '@/lib/i18n/support';
import { CareerFrame, panelClass } from '@/components/candidate/career-shared';

const categories: { value: SupportCategory; key: string }[] = [
  { value: 'ACCOUNT', key: 'account' },
  { value: 'CV_ATS', key: 'categoryCv' },
  { value: 'JOB_APPLICATION', key: 'categoryApplication' },
  { value: 'AUTO_APPLY', key: 'categoryAutoApply' },
  { value: 'INTERVIEW_PREPARATION', key: 'categoryInterview' },
  { value: 'SUBSCRIPTION_PAYMENT', key: 'categorySubscription' },
  { value: 'BUG', key: 'bug' },
  { value: 'OTHER', key: 'other' },
];
const statuses = ['ALL', 'OPEN', 'WAITING_USER', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

export function SupportPage() {
  const t = useSupportText();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof statuses)[number]>('ALL');
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportCategory>('ACCOUNT');
  const [priority, setPriority] = useState('NORMAL');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [reply, setReply] = useState('');
  const [replyFile, setReplyFile] = useState<File | null>(null);

  const tickets = useQuery({
    queryKey: ['support-tickets', search, status],
    queryFn: () => supportApi.list({ search: search.trim() || undefined, status: status === 'ALL' ? undefined : status }),
    staleTime: 10_000,
  });
  const conversation = useQuery({
    queryKey: ['support-ticket', selectedRef],
    queryFn: () => supportApi.messages(selectedRef!),
    enabled: Boolean(selectedRef),
  });
  const ticket = conversation.data;

  const create = useMutation({
    mutationFn: () => {
      if (subject.trim().length < 2 || body.trim().length < 10) throw new Error(t('invalid'));
      const form = new FormData();
      form.append('subject', subject.trim());
      form.append('category', category);
      form.append('priority', priority);
      form.append('message', body.trim());
      if (file) form.append('attachment', file);
      return supportApi.create(form);
    },
    onSuccess: created => {
      setNewOpen(false);
      setSubject('');
      setBody('');
      setFile(null);
      setPriority('NORMAL');
      setSelectedRef(created.reference);
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      qc.invalidateQueries({ queryKey: ['support-unread'] });
      toast.success(t('ticketCreated'));
    },
    onError: error => toast.error(error instanceof Error ? error.message : t('invalid')),
  });

  const send = useMutation({
    mutationFn: () => {
      if (!selectedRef || reply.trim().length < 1) throw new Error(t('messageRequired'));
      const form = new FormData();
      form.append('message', reply.trim());
      if (replyFile) form.append('attachment', replyFile);
      return supportApi.sendMessage(selectedRef, form);
    },
    onSuccess: () => {
      setReply('');
      setReplyFile(null);
      qc.invalidateQueries({ queryKey: ['support-ticket', selectedRef] });
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      qc.invalidateQueries({ queryKey: ['support-unread'] });
    },
    onError: error => toast.error(error instanceof Error ? error.message : t('invalid')),
  });

  const statusLabel = (value: string) => ({
    OPEN: t('statusOpen'),
    WAITING_USER: t('statusWaitingShort'),
    IN_PROGRESS: t('statusInProgress'),
    RESOLVED: t('statusResolved'),
    CLOSED: t('statusClosed'),
  }[value] ?? value);
  const categoryLabel = (value: string) => t((categories.find(item => item.value === value)?.key ?? 'other') as never);
  const filtered = useMemo(() => tickets.data ?? [], [tickets.data]);
  const refresh = async () => {
    await Promise.all([tickets.refetch(), selectedRef ? conversation.refetch() : Promise.resolve()]);
    await qc.invalidateQueries({ queryKey: ['support-unread'] });
  };

  return <CareerFrame title={t('title')} description={t('subtitle')} showFindJob={false} actions={<Button variant="outline" onClick={() => void refresh()} disabled={tickets.isFetching || conversation.isFetching}><RefreshCw className={`me-2 size-4 ${(tickets.isFetching || conversation.isFetching) ? 'animate-spin' : ''}`} />{t('refresh')}</Button>}>
    <div className="flex w-full min-w-0 flex-col gap-6">
      {selectedRef && <section className={`${panelClass} flex min-h-[260px] w-full min-w-0 flex-col overflow-hidden p-0`}>
        {conversation.isPending ? <EasyJobLoading className="min-h-[260px] flex-1" /> : conversation.isError || !ticket ? <div className="p-6 text-sm text-destructive">{t('invalid')}</div> : <><header className="flex min-w-0 items-start justify-between gap-3 border-b p-5"><div className="flex min-w-0 items-start gap-2"><Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setSelectedRef(null)} aria-label={t('back')}><ArrowLeft className="size-4" /></Button><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-semibold">{ticket.reference} · {ticket.subject}</h2><span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{statusLabel(ticket.status)}</span></div><p className="mt-1 truncate text-xs text-muted-foreground">{categoryLabel(ticket.category)} · {t('priority')}: {ticket.priority}</p></div></div><Button variant="ghost" size="icon-sm" className="hidden lg:inline-flex" onClick={() => setSelectedRef(null)} aria-label={t('close')}><X className="size-4" /></Button></header><div className="max-h-[420px] min-h-[180px] flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-5">{ticket.messages?.map(item => <div key={item.id} className={`flex min-w-0 ${item.senderType === 'USER' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] lg:max-w-3xl min-w-0 [overflow-wrap:anywhere] break-words rounded-2xl px-4 py-3 text-sm ${item.senderType === 'USER' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}><p className="mb-1 text-[11px] font-semibold opacity-75">{item.senderType === 'USER' ? t('me') : t('supportTeam')}</p><p className="whitespace-pre-wrap break-words">{item.message}</p>{item.attachment && <button type="button" className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-xs underline" onClick={async () => { const result = await supportApi.attachment(ticket.reference, item.id); window.open(result.url, '_blank', 'noopener,noreferrer'); }}><FileText className="size-3 shrink-0" />{item.attachment.name}</button>}<time className="mt-2 block text-[10px] opacity-70">{new Date(item.createdAt).toLocaleString()}</time></div></div>)}</div><form className="shrink-0 border-t bg-background/80 p-4" onSubmit={event => { event.preventDefault(); send.mutate(); }}><div className="flex items-end gap-2"><Textarea value={reply} onChange={event => setReply(event.target.value)} placeholder={t('writeMessage')} rows={3} className="min-h-20 min-w-0 resize-none" disabled={ticket.status === 'CLOSED' || send.isPending} /><Button type="submit" size="icon-lg" className="shrink-0" disabled={ticket.status === 'CLOSED' || send.isPending || !reply.trim()} aria-label={t('send')}><Send className="size-4" /></Button></div><label className="mt-2 inline-flex max-w-full cursor-pointer items-center gap-2 truncate text-xs text-muted-foreground"><Paperclip className="size-3.5 shrink-0" />{replyFile?.name ?? t('attachment')}<input type="file" className="sr-only" accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.webp" onChange={event => setReplyFile(event.target.files?.[0] ?? null)} /></label></form></>}</section>}

      <section className={`${panelClass} flex min-h-[420px] w-full min-w-0 flex-col gap-5 overflow-hidden p-5`}>
        <div className="flex min-w-0 flex-col items-stretch gap-3"><div className="min-w-0"><h2 className="text-lg font-semibold">{t('ticketList')}</h2><p className="mt-1 max-w-[48ch] text-sm leading-5 text-muted-foreground">{t('manageTickets')}</p></div><Button size="sm" className="w-full shrink-0 sm:w-fit" onClick={() => setNewOpen(true)}><Plus className="me-1 size-4" />{t('newTicket')}</Button></div>
        <label className="block w-full"><InputWithIcon icon={<Search className="size-4" />} value={search} onChange={event => setSearch(event.target.value)} placeholder={t('searchTickets')} className="h-10 w-full pe-3" aria-label={t('searchTickets')} /></label>
        <div className="flex flex-wrap gap-2">{statuses.map(item => <button key={item} type="button" onClick={() => setStatus(item)} className={`rounded-lg px-3 py-2 text-xs font-medium transition ${status === item ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/70 text-muted-foreground hover:text-foreground'}`}>{item === 'ALL' ? t('all') : statusLabel(item)}</button>)}</div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">{tickets.isPending ? <EasyJobLoading /> : tickets.isError ? <p className="p-3 text-sm text-destructive">{t('invalid')}</p> : filtered.length ? filtered.map(item => <button key={item.id} type="button" onClick={() => setSelectedRef(item.reference)} className={`grid w-full min-w-0 items-center gap-2 rounded-xl border p-3 text-start transition hover:border-primary/50 hover:bg-muted/40 md:grid-cols-[110px_minmax(180px,1.2fr)_minmax(140px,1fr)_auto_auto_auto] ${selectedRef === item.reference ? 'border-primary bg-primary/5' : 'border-border'}`}><span className="truncate text-xs font-semibold text-muted-foreground">{item.reference}</span><span className="min-w-0 truncate text-sm font-semibold">{item.subject}</span><span className="min-w-0 truncate text-xs text-muted-foreground">{item.lastMessage?.message ?? ''}</span><span className="justify-self-start rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{statusLabel(item.status)}</span><time className="text-xs text-muted-foreground">{new Date(item.lastMessageAt).toLocaleDateString()}</time>{item.unreadCount > 0 ? <span className="size-2 rounded-full bg-primary" aria-label={t('unread')} /> : <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />}</button>) : <div className="rounded-xl border border-dashed p-6 text-center"><p className="font-medium">{t('noTickets')}</p><p className="mt-1 text-sm text-muted-foreground">{t('noTicketsHelp')}</p></div>}</div>
      </section>
    </div>

    <Dialog open={newOpen} onOpenChange={setNewOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{t('newTicket')}</DialogTitle><DialogDescription>{t('contactHelp')}</DialogDescription></DialogHeader><div className="space-y-4"><label className="space-y-2 text-sm font-medium"><span>{t('subject')}</span><Input value={subject} onChange={event => setSubject(event.target.value)} maxLength={160} placeholder={t('subjectPlaceholder')} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium"><span>{t('category')}</span><select value={category} onChange={event => setCategory(event.target.value as SupportCategory)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">{categories.map(item => <option key={item.value} value={item.value}>{t(item.key as never)}</option>)}</select></label><label className="space-y-2 text-sm font-medium"><span>{t('priority')}</span><select value={priority} onChange={event => setPriority(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="LOW">{t('low')}</option><option value="NORMAL">{t('normal')}</option><option value="HIGH">{t('high')}</option></select></label></div><label className="space-y-2 text-sm font-medium"><span>{t('message')}</span><Textarea value={body} onChange={event => setBody(event.target.value)} rows={7} maxLength={12000} placeholder={t('messagePlaceholder')} /></label><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground"><Paperclip className="size-4" />{file?.name ?? t('attachment')}<input type="file" className="sr-only" accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.webp" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label></div><DialogFooter><Button variant="outline" onClick={() => setNewOpen(false)}>{t('cancel')}</Button><Button disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending && <Loader2 className="me-2 size-4 animate-spin" />}{t('send')}</Button></DialogFooter></DialogContent></Dialog>
  </CareerFrame>;
}


