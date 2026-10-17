'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { ErrorState, PageHeader, SkeletonRows } from '@/components/shared';
import { adminApi } from '@/lib/api/admin';
import { useCareerText } from '@/lib/i18n/career';

export default function AdminJobSourcesPage() {
  const t = useCareerText();
  const sources = useQuery({ queryKey: ['admin-job-sources'], queryFn: adminApi.jobSources });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t('jobSourceDashboard')} description={t('jobSourceDashboardHelp')} />
      <div className="mt-8">
        {sources.isPending ? <SkeletonRows rows={5} cols={5} /> : sources.isError ? (
          <ErrorState message={t('jobSourcesUnavailable')} retry={() => sources.refetch()} />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t('source')}</th>
                  <th className="px-4 py-3">{t('status')}</th>
                  <th className="px-4 py-3">{t('lastSync')}</th>
                  <th className="px-4 py-3 text-right">{t('indexedListings')}</th>
                  <th className="px-4 py-3 text-right">{t('activeJobs')}</th>
                  <th className="px-4 py-3 text-right">{t('closedJobs')}</th><th className="px-4 py-3">Dernière exécution</th>
                </tr>
              </thead>
              <tbody>
                {sources.data.map(source => (
                  <tr key={source.type} className="border-t align-top">
                    <td className="px-4 py-4 font-medium">{source.name}{source.info && <a href={source.info.evidenceUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-primary underline">Documentation</a>}<p className="mt-2 text-xs text-muted-foreground">{source.application?.method}</p></td>
                    <td className="px-4 py-4">
                      <Badge variant={source.status === 'ACTIVE' ? 'default' : 'secondary'}>{t(source.status)}</Badge>
                      {source.detail && <p className="mt-2 max-w-sm text-xs text-muted-foreground">{source.detail}</p>}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleString() : t('neverSynced')}
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums">{source.listingCount}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{source.activeJobs}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{source.closedJobs}</td><td className="min-w-52 px-4 py-4 text-xs text-muted-foreground"><p>Importées {source.lastImported ?? 0} · Modifiées {source.lastUpdated ?? 0}</p><p>Expirées {source.lastExpired ?? 0} · Rejetées {source.lastRejected ?? 0} · Doublons {source.lastDuplicates ?? 0}</p><p>{source.lastDurationMs != null ? `${source.lastDurationMs} ms` : '—'}</p>{source.lastErrorCode && <p className="mt-1 text-destructive">{source.lastErrorCode}{source.lastHttpStatus ? ` · HTTP ${source.lastHttpStatus}` : ''}</p>}{source.lastFailureAt && <p>Dernier échec : {new Date(source.lastFailureAt).toLocaleString()}</p>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
