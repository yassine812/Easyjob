'use client';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { PageHeader, ErrorState, PaginationControls, SkeletonRows } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatMoney } from '@/lib/format';
import { adminStatusLabel } from '@/lib/admin-labels';
import { useState } from 'react';

export default function PlatformAdminInvoicesPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ['platform-admin-invoices', page], queryFn: () => adminApi.invoices({ page, limit: 20 }) });
  if (query.isPending) return <SkeletonRows rows={8} cols={6} />;
  if (query.isError || !query.data) return <ErrorState message="Impossible de charger les factures." retry={() => query.refetch()} />;
  return <div className="mx-auto max-w-6xl"><PageHeader title="Factures" description="Contrôle des factures générées après paiement confirmé." /><div className="mt-8 overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[1040px] text-sm"><thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>{['Numéro','Type','Client','Plan','Montant','Statut','Date','PDF','DOCX'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{query.data.items.length ? query.data.items.map((invoice) => <tr key={invoice.id} className="border-t"><td className="px-4 py-3 font-mono text-xs">{invoice.invoice?.number ?? invoice.providerPaymentId ?? invoice.id}</td><td className="px-4 py-3">{invoice.subscription.ownerType === 'CANDIDATE' ? 'Candidat' : 'Entreprise'}</td><td className="px-4 py-3">{invoice.subscription.company?.commercialName ?? invoice.subscription.candidate?.user.name ?? '—'}</td><td className="px-4 py-3">{invoice.subscription.plan?.name ?? '—'}</td><td className="px-4 py-3">{formatMoney(invoice.amountCents, invoice.currency)}</td><td className="px-4 py-3"><Badge variant={invoice.status === 'SUCCEEDED' ? 'success' : invoice.status === 'FAILED' ? 'destructive' : 'warning'}>{adminStatusLabel(invoice.status)}</Badge></td><td className="px-4 py-3 text-muted-foreground">{formatDate(invoice.paidAt ?? invoice.createdAt)}</td><td className="px-4 py-3">{invoice.invoice?.pdfUrl ? <a className="text-primary underline" href={invoice.invoice.pdfUrl} target="_blank" rel="noreferrer">Télécharger</a> : '—'}</td><td className="px-4 py-3">{invoice.invoice?.docxUrl ? <a className="text-primary underline" href={invoice.invoice.docxUrl} target="_blank" rel="noreferrer">Télécharger</a> : '—'}</td></tr>) : <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">Aucune facture.</td></tr>}</tbody></table></div><PaginationControls page={page} totalPages={query.data.totalPages} total={query.data.total} onPageChange={setPage} /></div>;
}
