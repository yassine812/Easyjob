'use client';
import { EasyJobLoading } from '@/components/ui/easyjob-loader';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { applicationsApi } from '@/lib/api/applications';
import { resolveResumeUrl } from '@/lib/api/resumes';
import { useCompanyText } from '@/lib/i18n/company';
import type { Application, Resume } from '@/types/api';
import { CvPdfViewer } from '@/components/candidate/cv-pdf-viewer';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function SubmittedCvPanel({ application: app, allowed }: { application: Application; allowed: boolean }) {
  const t = useCompanyText(), [downloading, setDownloading] = useState(false);
  const hasFile = !!(app.submittedCv || app.resumeId);
  const query = useQuery({ queryKey: ['application-cv', app.id], queryFn: () => applicationsApi.cvUrl(app.id), enabled: allowed && hasFile, staleTime: 0 });
  const file = app.submittedCv ?? app.resume;
  const url = query.data ? resolveResumeUrl(query.data.url) : '';
  const download = async () => {
    setDownloading(true);
    try { const response = await fetch(url); if (!response.ok) throw new Error('download'); const blob = await response.blob(); const object = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = object; link.download = query.data?.filename || file?.filename || 'CV'; link.click(); setTimeout(() => URL.revokeObjectURL(object), 1000); }
    catch { toast.error(t('saveError')); } finally { setDownloading(false); }
  };
  return <section className="space-y-4"><header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{t('cvUsedForApplication')}</h2><p className="mt-1 text-sm">{file?.filename || t('cvUnavailable')}</p>{file && <p className="mt-1 text-xs text-muted-foreground">{(file.fileSize / 1024).toFixed(0)} KB · {t('version')} {file.version} · {t('submittedOn')} {new Date(app.appliedAt).toLocaleDateString()}</p>}<p className="mt-2 text-xs text-muted-foreground">{t('cvSnapshotHelp')}</p></div>{url && <div className="flex gap-2"><Button asChild variant="outline" size="sm"><a href={url} target="_blank" rel="noreferrer">{t('openCv')}</a></Button><Button size="sm" disabled={downloading} onClick={() => void download()}>{t('download')}</Button></div>}</header>
    {!allowed || !hasFile ? <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{t('cvUnavailable')}</p> : query.isError ? <Button variant="outline" onClick={() => void query.refetch()}>{t('retry')}</Button> : query.isPending ? <EasyJobLoading label={t('loading')} /> : url && file?.mimeType === 'application/pdf' ? <CvPdfViewer sourceUrl={url} resume={{ ...file, id: app.resumeId || app.id, isPrimary: false, processingStatus: 'COMPLETED', createdAt: app.appliedAt } as Resume} /> : <p className="rounded-xl border p-6 text-sm text-muted-foreground">{t('noFilePreview')}</p>}
  </section>;
}
