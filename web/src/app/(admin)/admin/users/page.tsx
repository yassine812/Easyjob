'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { usersApi } from '@/lib/api/users';
import { ApiError } from '@/lib/api/client';
import { PageHeader, ErrorState, PaginationControls, SkeletonRows } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MEMBER_ROLE_LABELS } from '@/lib/constants';
import { formatDate, initials } from '@/lib/format';

const ALL_ROLES = [
  'PLATFORM_ADMIN',
  'COMPANY_ADMIN',
  'HR',
  'RECRUITER',
  'HIRING_MANAGER',
  'INTERVIEWER',
  'CANDIDATE',
];

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const users = useQuery({
    queryKey: ['admin-users', { page, search, status }],
    queryFn: () =>
      usersApi.adminList({
        page,
        limit: 20,
        search: search || undefined,
        status: status !== 'all' ? status : undefined,
      }),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'ACTIVE' | 'SUSPENDED' }) =>
      usersApi.adminUpdate(id, { status: next }),
    onSuccess: () => {
      toast.success('User status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update user'),
  });

  const assignRoles = useMutation({
    mutationFn: () => usersApi.adminAssignRoles(editingId!, { roleNames: selectedRoles }),
    onSuccess: () => {
      toast.success('Roles updated');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update roles'),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Users" description="Manage platform users and roles.">
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name or email"
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
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      <div className="mt-8">
        {users.isPending ? (
          <SkeletonRows rows={8} cols={5} />
        ) : users.isError ? (
          <ErrorState message="Could not load users." retry={() => users.refetch()} />
        ) : users.data && users.data.items.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Roles</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.items.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-7">
                            <AvatarFallback className="bg-primary/10 text-[10px]">
                              {initials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={u.status === 'ACTIVE' ? 'success' : 'destructive'}>
                          {u.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(u.roles ?? []).map((r) => (
                            <Badge key={r} variant="outline" className="text-[10px]">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingId(u.id);
                              setSelectedRoles(u.roles ?? []);
                            }}
                          >
                            Roles
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={
                              u.status === 'ACTIVE'
                                ? 'text-destructive hover:text-destructive'
                                : 'text-emerald-600 hover:text-emerald-600'
                            }
                            onClick={() =>
                              toggleStatus.mutate({
                                id: u.id,
                                next: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                              })
                            }
                          >
                            {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={page}
              totalPages={users.data.totalPages}
              total={users.data.total}
              onPageChange={setPage}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No users found.</p>
        )}
      </div>

      <Dialog open={!!editingId} onOpenChange={(o) => !o && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign roles</DialogTitle>
            <DialogDescription>Replace the full set of platform roles for this user.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {ALL_ROLES.map((r) => {
              const active = selectedRoles.includes(r);
              return (
                <Button
                  key={r}
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  onClick={() =>
                    setSelectedRoles((prev) =>
                      active ? prev.filter((x) => x !== r) : [...prev, r],
                    )
                  }
                >
                  {MEMBER_ROLE_LABELS[r] ?? r}
                </Button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button onClick={() => assignRoles.mutate()} disabled={assignRoles.isPending}>
              {assignRoles.isPending ? 'Saving…' : 'Save roles'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
