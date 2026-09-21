'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { analyticsApi } from '@/lib/api/analytics';
import { PageHeader, StatCard, SkeletonRows, ErrorState } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/lib/format';

export default function AdminDashboardPage() {
  const analytics = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => analyticsApi.platform(),
    staleTime: 60_000,
  });

  if (analytics.isPending) return <SkeletonRows rows={4} cols={4} />;
  if (analytics.isError || !analytics.data) {
    return <ErrorState message="Could not load platform metrics." retry={() => analytics.refetch()} />;
  }
  const a = analytics.data;

  const revenueData = Object.entries(a.revenueByCurrencyCents).map(([currency, cents]) => ({
    name: currency,
    value: cents / 100,
    cents,
  }));
  const aiData = Object.entries(a.aiUsage).map(([status, count]) => ({ name: status, value: count }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Platform dashboard" description="Overview of the entire platform." />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/users">
          <StatCard label="Users" value={a.users} hint={`${a.candidates} candidates`} />
        </Link>
        <Link href="/admin/companies">
          <StatCard label="Companies" value={a.companies} hint={`${a.verifiedCompanies} verified`} />
        </Link>
        <Link href="/admin/jobs">
          <StatCard label="Jobs" value={a.jobs} hint={`${a.applications} applications`} />
        </Link>
        <Link href="/admin/subscriptions">
          <StatCard label="Active subscriptions" value={a.activeSubscriptions} hint={`${a.hires} hires`} />
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by currency</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {revenueData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No revenue yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(_value, _name, entry) => formatMoney(entry.payload.cents, entry.payload.name)} />
                  <Bar dataKey="value" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>AI usage by status</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {aiData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No AI usage yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aiData}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
