'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Search, XCircle } from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { ApiError } from '@/lib/api/client';
import { PageHeader, ErrorState, PaginationControls, SkeletonRows } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { JOB_STATUS_LABELS } from '@/lib/constants';
import { adminStatusLabel } from '@/lib/admin-labels';
import { formatDate } from '@/lib/format';

export default function AdminJobsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const jobs = useQuery({
    queryKey: ['admin-jobs', { page, search, status }],
    queryFn: () =>
      adminApi.jobs({
        page,
        limit: 20,
        search: search || undefined,
        status: status !== 'all' ? status : undefined,
      }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });

  const approve = useMutation({
    mutationFn: (id: string) => adminApi.approveJob(id),
    onSuccess: () => {
      toast.success('Offre approuvée');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Impossible d’approuver l’offre'),
  });

  const reject = useMutation({
    mutationFn: () => adminApi.rejectJob(rejectingId!, reason),
    onSuccess: () => {
      toast.success('Offre refusée');
      setRejectingId(null);
      setReason('');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Impossible de refuser l’offre'),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Offres" description="Approuver ou refuser les offres publiées.">
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher une offre"
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
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(JOB_STATUS_LABELS).map(([k]) => (
                <SelectItem key={k} value={k}>
                  {adminStatusLabel(k)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      <div className="mt-8">
        {jobs.isPending ? (
          <SkeletonRows rows={8} cols={5} />
        ) : jobs.isError ? (
          <ErrorState message="Impossible de charger les offres." retry={() => jobs.refetch()} />
        ) : jobs.data && jobs.data.items.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Offre</th>
                    <th className="px-4 py-3">Entreprise</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Candidatures</th>
                    <th className="px-4 py-3">Créée le</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.data.items.map((j) => (
                    <tr key={j.id} className="border-t">
                      <td className="px-4 py-3 font-medium">{j.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{j.company?.commercialName}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{adminStatusLabel(j.status)}</Badge>
                      </td>
                      <td className="px-4 py-3">{j._count?.applications ?? 0}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(j.createdAt)}</td>
                      <td className="px-4 py-3">
                        {j.status === 'PENDING_APPROVAL' ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-emerald-600 hover:text-emerald-600"
                              onClick={() => approve.mutate(j.id)}
                            >
                              <CheckCircle2 className="mr-1 size-3.5" /> Approuver
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setRejectingId(j.id)}
                            >
                              <XCircle className="mr-1 size-3.5" /> Refuser
                            </Button>
                          </div>
                        ) : (
                          <div className="text-right text-xs text-muted-foreground">
                            {j.rejectionReason ? `Refus : ${j.rejectionReason}` : '—'}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={page}
              totalPages={jobs.data.totalPages}
              total={jobs.data.total}
              onPageChange={setPage}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune offre trouvée.</p>
        )}
      </div>

      <Dialog open={!!rejectingId} onOpenChange={(o) => !o && setRejectingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser l’offre</DialogTitle>
            <DialogDescription>L’auteur de l’offre recevra ce motif.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif du refus"
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingId(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || reject.isPending}
              onClick={() => reject.mutate()}
            >
              {reject.isPending ? 'Refus en cours…' : 'Refuser l’offre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
