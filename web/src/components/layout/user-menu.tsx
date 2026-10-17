'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronDown, LogOut, ShieldCheck, User } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { logoutFlow } from '@/providers/auth-provider';
import { disconnectSocket } from '@/lib/api/ws';
import { resolveAccountType } from '@/lib/permissions';
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
import { useI18n } from '@/lib/i18n';
import { CandidateAvatar, displayCandidateName } from '@/components/candidate/candidate-avatar';

export function UserMenu() {
  const router = useRouter(); const params = useParams<{ companyId?: string }>(); const ux = useUxText(); const { can } = useRole(); const [open, setOpen] = useState(false);
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
  const name = displayCandidateName(user.name);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 rounded-xl px-2 py-1.5 hover:bg-muted" aria-label={ux('account')}>
          {accountType === 'candidate' ? <CandidateAvatar name={name} className="size-9" fallbackClassName="bg-primary/10 text-xs font-semibold" /> : <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-xs font-semibold">{name.slice(0, 2)}</span>}
          <span className="hidden max-w-32 truncate text-sm font-semibold sm:block">{name}</span>
          <ChevronDown className={`hidden size-4 text-muted-foreground transition-transform duration-200 sm:block ${open ? 'rotate-180' : ''}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accountType === 'admin' ? (
          <DropdownMenuItem asChild>
            <Link href="/platform-admin">
              <ShieldCheck className="mr-2 size-4" /> {t.nav.admin}
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
        {accountType === 'candidate' && <DropdownMenuItem asChild>
          <Link href="/candidate/profile">
            <User className="me-2 size-4" /> {t.common.profile}
          </Link>
        </DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout}>
          <LogOut className="mr-2 size-4" /> {t.common.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
