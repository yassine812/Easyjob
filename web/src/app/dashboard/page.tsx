'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { getDashboardRoute } from '@/lib/permissions';
import { PageLoader } from '@/components/shared';

export default function DashboardRedirectPage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (!user) return;
    router.replace(getDashboardRoute(user));
  }, [status, user, router]);

  return <PageLoader />;
}
