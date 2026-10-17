'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useCompanyText } from '@/lib/i18n/company';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useActiveCompany } from '@/hooks/use-company';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { COMPANY_STATUS_LABELS } from '@/lib/constants';

/**
 * Company switcher — only useful when a recruiter can actually change
 * organisations. A single membership is selected automatically by the
 * session bootstrap, so showing a disabled-looking dropdown adds noise.
 */
export function CompanySwitcher() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useCompanyText();
  const memberships = useAuthStore((s) => s.user?.memberships ?? []);
  const { activeCompany } = useActiveCompany();

  if (memberships.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-0 max-w-[126px] gap-2 sm:max-w-none">
          <Building2 className="hidden size-4 text-muted-foreground sm:block" />
          <span className="max-w-16 truncate sm:max-w-40">{activeCompany?.companyName ?? t('selectCompany')}</span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t('yourCompanies')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.companyId}
            className="flex items-center justify-between"
            onClick={async () => {
              if (activeCompany?.companyId === m.companyId) return;
              await queryClient.cancelQueries();
              queryClient.clear();
              router.push(`/company/${m.companyId}/dashboard`);
            }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{m.companyName}</span>
              <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">
                {t(m.role)}
              </Badge>
            </span>
            {activeCompany?.companyId === m.companyId ? <Check className="size-4 shrink-0" /> : null}
          </DropdownMenuItem>
        ))}

      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { COMPANY_STATUS_LABELS };
