'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Eye, XCircle } from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { ApiError } from '@/lib/api/client';
import { PageHeader, ErrorState, PaginationControls, SkeletonRows } from '@/components/shared';
import { Button } from '@/components/ui/button';
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
import { VERIFICATION_STATUS_LABELS } from '@/lib/constants';
import { adminStatusLabel } from '@/lib/admin-labels';
import { formatDateTime, formatFileSize } from '@/lib/format';

export default function AdminVerificationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const verifications = useQuery({
    queryKey: ['admin-verifications', { page, status }],
    queryFn: () =>
      adminApi.verifications({
        page,
        limit: 20,
        status: status !== 'all' ? status : undefined,
      }),
  });
  const detail = useQuery({
    queryKey: ['admin-verification', detailId],
    queryFn: () => adminApi.verification(detailId!),
    enabled: !!detailId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
    if (detailId) queryClient.invalidateQueries({ queryKey: ['admin-verification', detailId] });
  };

  const approve = useMutation({
    mutationFn: (id: string) => adminApi.approveVerification(id),
    onSuccess: () => {
      toast.success('Entreprise vérifiée — maintenant ACTIVE');
      setDetailId(null);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Impossible d’approuver'),
  });

  const reject = useMutation({
    mutationFn: () => adminApi.rejectVerification(rejectingId!, reason),
    onSuccess: () => {
      toast.success('Verification rejected');
      setRejectingId(null);
      setReason('');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Impossible de refuser'),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Vérifications" description="Examiner les dossiers de vérification des entreprises.">
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
            {Object.entries(VERIFICATION_STATUS_LABELS).map(([k]) => (
              <SelectItem key={k} value={k}>
                  {adminStatusLabel(k)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      <div className="mt-8">
        {verifications.isPending ? (
          <SkeletonRows rows={8} cols={5} />
        ) : verifications.isError ? (
          <ErrorState message="Impossible de charger les vérifications." retry={() => verifications.refetch()} />
        ) : verifications.data && verifications.data.items.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Entreprise</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Soumis le</th>
                    <th className="px-4 py-3">Documents</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {verifications.data.items.map((v) => (
                    <tr key={v.id} className="border-t">
                      <td className="px-4 py-3">
                        <p className="font-medium">{v.company?.commercialName}</p>
                        <p className="text-xs text-muted-foreground">{v.company?.legalName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            v.status === 'VERIFIED'
                              ? 'success'
                              : v.status === 'REJECTED'
                                ? 'destructive'
                                : 'warning'
                          }
                        >
                          {adminStatusLabel(v.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {v.submittedAt ? formatDateTime(v.submittedAt) : '—'}
                      </td>
                      <td className="px-4 py-3">{v.documents?.length ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setDetailId(v.id)}>
                            <Eye className="mr-1 size-3.5" /> Examiner
                          </Button>
                          {v.status === 'UNDER_REVIEW' || v.status === 'PENDING' ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-emerald-600 hover:text-emerald-600"
                                onClick={() => approve.mutate(v.id)}
                              >
                                <CheckCircle2 className="mr-1 size-3.5" /> Approuver
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setRejectingId(v.id)}
                              >
                                <XCircle className="mr-1 size-3.5" /> Refuser
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={page}
              totalPages={verifications.data.totalPages}
              total={verifications.data.total}
              onPageChange={setPage}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune vérification trouvée.</p>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revue de vérification</DialogTitle>
            <DialogDescription>
              {detail.data?.company?.commercialName} — {detail.data?.company?.legalName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="flex gap-2">
              <Badge variant="secondary">Statut : {adminStatusLabel(detail.data?.status ?? 'PENDING')}</Badge>
              {detail.data?.rejectionReason ? (
                <Badge variant="destructive">Motif : {detail.data.rejectionReason}</Badge>
              ) : null}
            </div>
            <p>
              <span className="text-muted-foreground">Identifiant d’enregistrement :</span>{' '}
              {detail.data?.company?.registrationIdentifier ?? '—'}
            </p>
            <div>
              <p className="font-medium">Documents ({detail.data?.documents?.length ?? 0})</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {(detail.data?.documents ?? []).map((d) => (
                  <li key={d.id}>
                    {d.filename} · {formatFileSize(d.fileSize)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {(detail.data?.status === 'UNDER_REVIEW' || detail.data?.status === 'PENDING') ? (
            <DialogFooter>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  setDetailId(null);
                  setRejectingId(detailId);
                }}
              >
                Refuser
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-600/90"
                onClick={() => approve.mutate(detailId!)}
              >
                Approuver et activer
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectingId} onOpenChange={(o) => !o && setRejectingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la vérification</DialogTitle>
            <DialogDescription>L’entreprise verra ce motif.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif (ex. document d’enregistrement manquant)"
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingId(null)}>
              Annuler
            </Button>
            <Button variant="destructive" disabled={!reason.trim() || reject.isPending} onClick={() => reject.mutate()}>
              {reject.isPending ? 'Refus en cours…' : 'Refuser la vérification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
