'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { billingApi } from '@/lib/api/billing';
import type { PlanType } from '@/types/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export interface Entitlement {
  planName: string;
  planType: PlanType;
  subscriptionStatus: string | null;
  /** Feature flag / limit accessor. */
  feature: (key: string) => unknown;
  limit: (key: string) => number | null;
  isPaid: boolean;
  loading: boolean;
  limitBanner: React.ReactNode;
}

export function useEntitlement(ownerType: PlanType, companyId?: string): Entitlement {
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');

  const query = useQuery({
    queryKey: ['subscription-me', ownerType, companyId],
    queryFn: () => billingApi.currentSubscription(ownerType, companyId),
    enabled: isAuthed && (ownerType === 'CANDIDATE' || !!companyId),
    staleTime: 30_000,
  });

  const data = query.data;
  const features = (data?.plan.features ?? {}) as Record<string, unknown>;
  const status = data?.subscription?.status ?? null;
  const planName = data?.plan.name ?? 'FREE';

  const feature = (key: string): unknown => features[key];
  const limit = (key: string): number | null => {
    const v = features[key];
    return typeof v === 'number' ? v : null;
  };

  const isPaid = status === 'ACTIVE' || status === 'TRIALING';

  const limitBanner = (
    <Alert className="mb-6">
      <ArrowUpRight className="size-4" />
      <AlertTitle>Free plan limits</AlertTitle>
      <AlertDescription className="flex items-center gap-2">
        Some AI tools require the PRO plan.{' '}
        <Link href={ownerType === 'CANDIDATE' ? '/candidate/subscription' : `/company/${companyId}/billing`} className="font-medium underline">
          Upgrade
        </Link>
      </AlertDescription>
    </Alert>
  );

  return {
    planName,
    planType: ownerType,
    subscriptionStatus: status,
    feature,
    limit,
    isPaid,
    loading: query.isPending,
    limitBanner,
  };
}
