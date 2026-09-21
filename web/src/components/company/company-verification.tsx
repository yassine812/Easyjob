'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { companiesApi } from '@/lib/api/companies';
import { useCompanyText } from '@/lib/i18n/company';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkspaceError, WorkspaceLoading } from './workspace-overview';
export function CompanyVerificationEditor({ companyId }: { companyId: string }) {
  const t = useCompanyText(); const qc = useQueryClient(); const [file, setFile] = useState<File | null>(null);
  const query = useQuery({ queryKey: ['company-verification', companyId], queryFn: () => companiesApi.verification(companyId) });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['company-verification', companyId] }); toast.success(t('saved')); };
  const upload = useMutation({ mutationFn: (file: File) => companiesApi.uploadVerificationDocument(companyId, file), onSuccess: () => { setFile(null); refresh(); }, onError: () => toast.error(t('saveError')) });
  const submit = useMutation({ mutationFn: () => companiesApi.submitVerification(companyId), onSuccess: refresh, onError: () => toast.error(t('saveError')) });
  if (query.isPending) return <WorkspaceLoading />; if (query.isError) return <WorkspaceError retry={() => void query.refetch()} />;
  return <div className="space-y-5"><h2 className="font-semibold">{t('verification')}</h2><p className="text-sm text-muted-foreground">{t('verificationHelp')}</p><span className="inline-block rounded bg-muted px-3 py-1 text-sm">{t(query.data.status)}</span><ul className="space-y-2">{query.data.documents.map(doc => <li key={doc.id} className="text-sm">{doc.filename} · {Math.ceil(doc.fileSize / 1024)} KB</li>)}</ul>{!['UNDER_REVIEW','VERIFIED'].includes(query.data.status) && <><label className="grid gap-2 text-sm">{t('verificationDocument')}<Input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt,.md" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label><div className="flex flex-wrap gap-3"><Button variant="outline" disabled={!file || upload.isPending} onClick={() => file && upload.mutate(file)}>{t('uploadDocument')}</Button><Button disabled={!query.data.documents.length || submit.isPending || upload.isPending} onClick={() => submit.mutate()}>{t('submitVerification')}</Button></div></>}</div>;
}
