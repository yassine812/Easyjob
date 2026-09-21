'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { RequireAuth } from '@/components/shared/guards';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, EmptyState, ErrorState, PaginationControls } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { items, total, totalPages, unreadCount, markRead, markAllRead, remove, isPending, isError, refetch } =
    useNotifications(page, 20);

  return (
    <RequireAuth>
      <AppShell nav={[]}>
        <div className="mx-auto max-w-3xl">
          <PageHeader
            title="Notifications"
            description={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'You are all caught up'}
          >
            <Button variant="outline" size="sm" onClick={() => markAllRead()} disabled={unreadCount === 0}>
              <CheckCheck className="mr-1 size-4" /> Mark all read
            </Button>
          </PageHeader>

          <div className="mt-8">
            {isPending ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl border bg-muted/40" />
                ))}
              </div>
            ) : isError ? (
              <ErrorState message="Could not load notifications." retry={() => refetch()} />
            ) : items.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No notifications"
                description="Updates about applications, interviews and your account will appear here."
              />
            ) : (
              <div className="space-y-2">
                {items.map((n) => (
                  <Card
                    key={n.id}
                    className={cn('flex items-start justify-between gap-3 p-4', !n.readAt && 'border-primary/30 bg-primary/[0.03]')}
                  >
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        if (!n.readAt) markRead(n.id);
                        const href = n.data?.href;
                        if (typeof href === 'string' && /^\/(?!\/)[^\\]*$/.test(href)) router.push(href);
                      }}
                    >
                      <p className={cn('text-sm', !n.readAt && 'font-medium')}>{n.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground/70">{formatRelative(n.createdAt)}</p>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground"
                      onClick={() => remove(n.id)}
                      aria-label="Delete notification"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </Card>
                ))}
                <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
