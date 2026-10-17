'use client';

import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';
import { useI18n } from '@/lib/i18n';
import type { PublicResearchResult, PublicResearchSource } from '@/lib/api/external-research';

const copy: Record<'en' | 'fr' | 'ar', Record<string, string>> = {
  en: { title: 'Public context', sources: 'Public sources', technologies: 'Publicly mentioned technologies', products: 'Products', repositories: 'Public repositories', loading: 'Public research in progress…', queued: 'Public research in progress…', disabled: 'Public research is not enabled.', unavailable: 'Public context unavailable. EasyJob suggestions remain available.', empty: 'No relevant public context found.', refresh: 'Refresh public context', consulted: 'Consulted', add: 'Add to skills', added: 'Added', site: 'Company site', github: 'GitHub', rss: 'Documentation' },
  fr: { title: 'Contexte public', sources: 'Sources publiques', technologies: 'Technologies mentionnées publiquement', products: 'Produits', repositories: 'Dépôts publics', loading: 'Recherche publique en cours…', queued: 'Recherche publique en cours…', disabled: 'La recherche publique n’est pas activée.', unavailable: 'Contexte public indisponible. Les suggestions EasyJob restent disponibles.', empty: 'Aucun contexte public pertinent trouvé.', refresh: 'Actualiser le contexte public', consulted: 'Consulté le', add: 'Ajouter aux compétences', added: 'Ajouté', site: 'Site de l’entreprise', github: 'GitHub', rss: 'Documentation' },
  ar: { title: 'السياق العمومي', sources: 'المصادر العمومية', technologies: 'التقنيات المذكورة عمومياً', products: 'المنتجات', repositories: 'المستودعات العمومية', loading: 'البحث العمومي جارٍ…', queued: 'البحث العمومي جارٍ…', disabled: 'البحث العمومي غير مفعّل.', unavailable: 'السياق العمومي غير متاح. تبقى اقتراحات EasyJob متاحة.', empty: 'ما لقيناش سياق عمومي مناسب.', refresh: 'حدّث السياق العمومي', consulted: 'تم الاطلاع في', add: 'أضف للمهارات', added: 'تمت الإضافة', site: 'موقع الشركة', github: 'GitHub', rss: 'التوثيق' },
} as const;

function sourceLabel(type: PublicResearchSource['type'], labels: Record<string, string>) { return labels[type] ?? labels.site; }
function readableSourceUrl(value: string) {
  try {
    const url = new URL(value);
    const segments = url.pathname.split('/').filter(Boolean);
    const path = url.hostname === 'github.com' ? segments.slice(0, 2) : segments.slice(0, 3);
    return [url.hostname, ...path].join('/');
  } catch {
    return value.replace(/^https?:\/\//, '').split(/[?#]/, 1)[0].replace(/\/$/, '');
  }
}
function consultedDate(value: string | undefined, locale: string) { if (!value) return ''; try { return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value)); } catch { return ''; } }

export function PublicContextPanel({ result, isLoading = false, isError = false, onRefresh, onApplySkill, appliedSkills = [], showDisabled = false, compact = false }: {
  result?: PublicResearchResult | null;
  isLoading?: boolean;
  isError?: boolean;
  onRefresh?: () => void;
  onApplySkill?: (technology: string) => void;
  appliedSkills?: string[];
  showDisabled?: boolean;
  compact?: boolean;
}) {
  const { locale } = useI18n();
  const labels = copy[locale];
  if (!showDisabled && result?.status === 'DISABLED') return null;
  const technologies = [...new Set(result?.technologies ?? [])];
  const products = [...new Set(result?.products ?? [])];
  const repositories = result?.public_repositories ?? [];
  const sources = result?.sources ?? [];
  const hasContent = Boolean(result?.summary || technologies.length || products.length || repositories.length || sources.length);
  const pending = isLoading || result?.status === 'QUEUED';
  return <section className={`rounded-xl border bg-background/70 p-4 ${compact ? 'space-y-3' : 'space-y-4'}`} aria-label={labels.title}>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-sm font-semibold"><EasyJobFeatureMark size="sm" className="text-primary" />{labels.title}</h3>{pending && <p role="status" className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />{labels.loading}</p>}{result?.status === 'DISABLED' && showDisabled && <p className="mt-1 text-xs text-muted-foreground">{labels.disabled}</p>}{result?.status === 'UNAVAILABLE' && <p role="status" className="mt-1 text-xs text-muted-foreground">{labels.unavailable}</p>}{isError && <p role="status" className="mt-1 text-xs text-muted-foreground">{labels.unavailable}</p>}</div>
      {onRefresh && <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={pending} className="gap-1.5 text-xs"><RefreshCw className="size-3.5" />{labels.refresh}</Button>}
    </header>
    {!pending && !isError && result?.status !== 'DISABLED' && result?.status !== 'UNAVAILABLE' && !hasContent && <p className="text-xs text-muted-foreground">{labels.empty}</p>}
    {!pending && hasContent && <div className="space-y-4">
      {result?.summary && <p className="text-sm leading-6 text-muted-foreground">{result.summary}</p>}
      {technologies.length > 0 && <div><h4 className="mb-2 text-xs font-semibold text-muted-foreground">{labels.technologies}</h4><div className="flex flex-wrap gap-2">{technologies.map(technology => { const applied = appliedSkills.some(value => value.toLowerCase() === technology.toLowerCase()); return <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-xs" key={technology}>{technology}{onApplySkill && <button type="button" className="ms-1 text-[11px] font-medium text-primary hover:underline" onClick={() => onApplySkill(technology)}>{applied ? labels.added : labels.add}</button>}</span>; })}</div></div>}
      {products.length > 0 && <div><h4 className="mb-2 text-xs font-semibold text-muted-foreground">{labels.products}</h4><div className="flex flex-wrap gap-2">{products.map(product => <span className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs" key={product}>{product}</span>)}</div></div>}
      {repositories.length > 0 && <div><h4 className="mb-2 text-xs font-semibold text-muted-foreground">{labels.repositories}</h4><div className="grid gap-2 sm:grid-cols-2">{repositories.slice(0, 6).map(repo => <a key={repo.url} href={repo.url} target="_blank" rel="noopener noreferrer" className="group rounded-lg border p-2.5 text-xs hover:border-primary/50"><span className="flex items-center justify-between gap-2 font-medium">{repo.name}<ExternalLink className="size-3 opacity-60 group-hover:opacity-100" /></span>{repo.description && <span className="mt-1 block line-clamp-2 text-muted-foreground">{repo.description}</span>}</a>)}</div></div>}
      {sources.length > 0 && <div><h4 className="mb-2 text-xs font-semibold text-muted-foreground">{labels.sources}</h4><div className="grid gap-2 sm:grid-cols-2">{sources.slice(0, 8).map(source => <a key={`${source.source_url}-${source.fetched_at ?? ''}`} href={source.source_url} target="_blank" rel="noopener noreferrer" className="group rounded-lg border p-2.5 text-xs hover:border-primary/50"><span className="flex items-center justify-between gap-2"><span className="font-medium">{sourceLabel(source.type, labels)} · {source.title || readableSourceUrl(source.source_url)}</span><ExternalLink className="size-3 opacity-60 group-hover:opacity-100" /></span><span className="mt-1 block truncate text-muted-foreground" title={source.source_url}>{readableSourceUrl(source.source_url)} ↗</span>{source.fetched_at && <span className="mt-1 block text-[11px] text-muted-foreground">{labels.consulted} {consultedDate(source.fetched_at, locale)}</span>}</a>)}</div></div>}
    </div>}
  </section>;
}
