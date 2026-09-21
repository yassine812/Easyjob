'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/use-notifications';
import { useCompanyText } from '@/lib/i18n/company';
import { Button } from '@/components/ui/button';
import { WorkspaceError, WorkspaceLoading } from './workspace-overview';
export function WorkspaceNotifications() {
  const [page, setPage] = useState(1); const t = useCompanyText(); const router = useRouter(); const query = useNotifications(page);
  return <div className="mx-auto max-w-4xl space-y-5"><header className="flex justify-between gap-3"><h1 className="text-2xl font-semibold">{t('notifications')}</h1><Button variant="outline" onClick={() => query.markAllRead()} disabled={!query.unreadCount}>{t('markAllRead')}</Button></header>{query.isPending ? <WorkspaceLoading /> : query.isError ? <WorkspaceError retry={() => void query.refetch()} /> : query.items.length ? query.items.map(n => <article key={n.id} className={`flex items-start gap-3 rounded-lg border bg-background p-4 ${!n.readAt ? 'border-primary/40' : ''}`}><button className="flex-1 text-start" onClick={() => { query.markRead(n.id); const href = n.data?.href; if (typeof href === 'string' && href.startsWith('/') && !href.startsWith('//') && !href.includes('\\')) router.push(href); }}><h2 className="font-medium">{n.title}</h2><p className="my-2 whitespace-pre-wrap text-sm text-muted-foreground">{n.message}</p><time className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</time></button><Button variant="ghost" size="sm" onClick={() => query.remove(n.id)}>{t('delete')}</Button></article>) : <p className="rounded border p-10 text-center text-muted-foreground">{t('empty')}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('previous')}</Button><Button variant="outline" disabled={page >= query.totalPages} onClick={() => setPage(p => p + 1)}>{t('next')}</Button></div></div>;
}
