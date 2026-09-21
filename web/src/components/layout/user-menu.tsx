'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { ChevronsUpDown, LogOut, ShieldCheck, User } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { logoutFlow } from '@/providers/auth-provider';
import { disconnectSocket } from '@/lib/api/ws';
import { resolveAccountType } from '@/lib/permissions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api/client';
import { env } from '@/config/env';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUxText } from '@/lib/i18n/ux';
import { useRole } from '@/hooks/use-auth';
import { initials } from '@/lib/format';

import { useI18n } from '@/lib/i18n';

function CandidateMenuPhoto({ name }: { name: string }) {
  const retries = useRef(0);
  // Share the photo cache with the profile editor so uploads/removals update the menu.
  const photo = useQuery({ queryKey: ['candidate-photo'], queryFn: () => api.get<{ url: string | null }>('/candidates/me/photo'), staleTime: 60_000 });
  const src = photo.data?.url ? new URL(photo.data.url, env.apiUrl).toString() : undefined;
  return <AvatarImage src={src} alt={name} crossOrigin="anonymous" referrerPolicy="no-referrer" onLoadingStatusChange={status => {
    if (status === 'loaded') retries.current = 0;
    if (status === 'error' && src && retries.current < 1) {
      retries.current += 1;
      void photo.refetch();
    }
  }} />;
}

export function UserMenu() {
  const router = useRouter(); const params = useParams<{ companyId?: string }>(); const ux = useUxText(); const { can } = useRole();
  const user = useAuthStore((s) => s.user);
  const { t } = useI18n();
  if (!user) return null;

  const handleLogout = async () => {
    await logoutFlow();
    disconnectSocket();
    router.replace('/login');
  };

  const accountType = resolveAccountType(user);
  const companyId = params?.companyId;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2" aria-label={ux('account')}>
          <Avatar className="size-8">
            {accountType === 'candidate' && <CandidateMenuPhoto key={user.id} name={user.name} />}
            <AvatarFallback className="bg-primary/10 text-xs font-semibold">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium sm:block">{user.name}</span>
          <ChevronsUpDown className="hidden size-4 text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accountType === 'admin' ? (
          <DropdownMenuItem asChild>
            <Link href="/admin/dashboard">
              <ShieldCheck className="mr-2 size-4" /> {t.nav.admin}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {accountType === 'candidate' ? (
          <DropdownMenuItem asChild>
            <Link href="/candidate/profile">
              <User className="mr-2 size-4" /> {t.common.profile}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {accountType === 'company' && companyId && can(companyId, 'team.manage') ? (
          <DropdownMenuItem asChild>
            <Link href={`/company/${companyId}/settings`}>
              <User className="me-2 size-4" /> {ux('companySettings')}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <User className="me-2 size-4" /> {ux('account')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout}>
          <LogOut className="mr-2 size-4" /> {t.common.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
