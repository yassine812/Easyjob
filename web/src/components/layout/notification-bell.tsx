'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCompanyText } from '@/lib/i18n/company';
import Link from 'next/link';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const t = useCompanyText(); const router = useRouter(); const companyId = useParams<{ companyId?: string }>()?.companyId;
  const { items, unreadCount, markRead, markAllRead, remove } = useNotifications(1, 8);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`${t('notifications')} (${unreadCount})`}>
          <Bell className="size-5" />
          {unreadCount > 0 ? (
            <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(340px,calc(100vw-2rem))]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t('notifications')}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => markAllRead()}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="mr-1 size-3.5" /> {t('markAllRead')}
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ScrollArea className="h-[320px]">
            <DropdownMenuGroup>
              {items.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  className="flex cursor-pointer items-start gap-3 px-4 py-3"
                  onClick={() => { markRead(n.id); const href = n.data?.href; if (typeof href === 'string' && href.startsWith('/') && !href.startsWith('//') && !href.includes('\\')) router.push(href); }}
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm', !n.readAt && 'font-medium')}>{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">{formatRelative(n.createdAt)}</p>
                  </div>
                  {!n.readAt ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" /> : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-muted-foreground"
                    aria-label="Delete notification"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(n.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </ScrollArea>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={companyId ? `/company/${companyId}/notifications` : "/notifications"} className="justify-center text-center text-xs font-medium">
            {t('notifications')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
