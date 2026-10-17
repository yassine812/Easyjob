'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import Link from 'next/link';
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
import { ADMIN_ROLE_LABELS, adminStatusLabel } from '@/lib/admin-labels';
import { formatDate, initials } from '@/lib/format';

const ALL_ROLES = [
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'OPERATIONS_ADMIN',
  'BILLING_ADMIN',
  'SUPPORT_ADMIN',
  'READ_ONLY_ADMIN',
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
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Impossible de modifier l’utilisateur'),
  });

  const assignRoles = useMutation({
    mutationFn: () => usersApi.adminAssignRoles(editingId!, { roleNames: selectedRoles }),
    onSuccess: () => {
      toast.success('Roles updated');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Impossible de modifier les rôles'),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Utilisateurs" description="Gérer les utilisateurs et les rôles de la plateforme.">
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un nom ou un e-mail"
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
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="ACTIVE">Actif</SelectItem>
              <SelectItem value="SUSPENDED">Suspendu</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      <div className="mt-8">
        {users.isPending ? (
          <SkeletonRows rows={8} cols={5} />
        ) : users.isError ? (
          <ErrorState message="Impossible de charger les utilisateurs." retry={() => users.refetch()} />
        ) : users.data && users.data.items.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Utilisateur</th>
                    <th className="px-4 py-3">E-mail</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Rôles</th>
                    <th className="px-4 py-3">Plan / expiration</th>
                    <th className="px-4 py-3">Inscription</th>
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
                          <Link href={`/platform-admin/users/${u.id}`} className="font-medium hover:text-primary">{u.name}</Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={u.status === 'ACTIVE' ? 'success' : 'destructive'}>
                          {adminStatusLabel(u.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(u.roles ?? []).map((r) => (
                            <Badge key={r} variant="outline" className="text-[10px]">
                              {ADMIN_ROLE_LABELS[r] ?? adminStatusLabel(r)}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3"><p>{u.subscription?.plan.name ?? '—'}</p>{u.subscription?.remainingDays != null && <Badge variant={u.subscription.remainingDays <= 7 ? 'warning' : 'success'}>{u.subscription.remainingDays === 0 ? 'Expiré' : `${u.subscription.remainingDays} j restants`}</Badge>}</td>
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
                            Rôles
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
                            {u.status === 'ACTIVE' ? 'Suspendre' : 'Activer'}
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
          <p className="text-sm text-muted-foreground">Aucun utilisateur trouvé.</p>
        )}
      </div>

      <Dialog open={!!editingId} onOpenChange={(o) => !o && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attribuer les rôles</DialogTitle>
            <DialogDescription>Remplacer l’ensemble des rôles plateforme de cet utilisateur.</DialogDescription>
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
                  {ADMIN_ROLE_LABELS[r] ?? MEMBER_ROLE_LABELS[r] ?? r}
                </Button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>
              Annuler
            </Button>
            <Button onClick={() => assignRoles.mutate()} disabled={assignRoles.isPending}>
              {assignRoles.isPending ? 'Enregistrement…' : 'Enregistrer les rôles'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
