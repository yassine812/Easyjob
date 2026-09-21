'use client';

import { useState } from 'react';
import { ProvisionCompany } from '@/components/admin/provision-company';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { PageHeader, ErrorState, PaginationControls, SkeletonRows } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COMPANY_STATUS_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/format';

export default function AdminCompaniesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const companies = useQuery({
    queryKey: ['admin-companies', { page, search, status }],
    queryFn: () =>
      adminApi.companies({
        page,
        limit: 20,
        search: search || undefined,
        status: status !== 'all' ? status : undefined,
      }),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Companies" description="All companies on the platform.">
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search company"
              className="w-56 pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(COMPANY_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      <div className="mt-8">
        <ProvisionCompany />
        {companies.isPending ? (
          <SkeletonRows rows={8} cols={5} />
        ) : companies.isError ? (
          <ErrorState message="Could not load companies." retry={() => companies.refetch()} />
        ) : companies.data && companies.data.items.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Slug</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Members</th>
                    <th className="px-4 py-3">Jobs</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.data.items.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.commercialName}</p>
                        <p className="text-xs text-muted-foreground">{c.legalName}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.slug}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            c.status === 'ACTIVE'
                              ? 'success'
                              : c.status === 'SUSPENDED'
                                ? 'destructive'
                                : 'warning'
                          }
                        >
                          {COMPANY_STATUS_LABELS[c.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{c._count?.members ?? 0}</td>
                      <td className="px-4 py-3">{c._count?.jobs ?? 0}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={page}
              totalPages={companies.data.totalPages}
              total={companies.data.total}
              onPageChange={setPage}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No companies found.</p>
        )}
      </div>
    </div>
  );
}
