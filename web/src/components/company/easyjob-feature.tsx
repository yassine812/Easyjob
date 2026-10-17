'use client';
import { EasyJobFeatureLabel } from '@/components/ui/easyjob-feature-mark';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRecruitmentText } from '@/lib/i18n/recruitment';
import { useEntitlement } from '@/hooks/use-entitlement';

export function EasyJobAvatar() { return <span role="img" aria-label="EasyJob" className="size-11 shrink-0 rounded-xl border bg-primary/5" style={{ backgroundImage: "url('/images/coach/easyjob-human-transparent.png')", backgroundSize: '660% 220%', backgroundPosition: '50% 0%', backgroundRepeat: 'no-repeat' }} />; }
export function AnalysisInfo({ label, help }: { label: string; help: string }) {
  return <span className="inline-flex items-center gap-1.5">{label}<Tooltip><TooltipTrigger asChild><button type="button" aria-label={help} className="inline-flex rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Info className="size-3.5" /></button></TooltipTrigger><TooltipContent>{help}</TooltipContent></Tooltip></span>;
}
export function EasyJobFeature({ label, companyId, feature = 'recruitment-analysis', help }: { label?: string; companyId?: string; feature?: string; help?: string }) {
  const t = useRecruitmentText();
  const entitlement = useEntitlement('COMPANY', companyId);
  const [discovered, setDiscovered] = useState(true);
  const storageKey = `easyjob-feature:${companyId}:${feature}`;
  const markSeen = () => { try { localStorage.setItem(storageKey, 'seen'); } catch { /* optional discovery */ } setDiscovered(true); };
  return <span className="inline-flex max-w-full items-center gap-2 text-sm font-semibold"><EasyJobFeatureLabel>{label || t('easyjobAnalysis')}</EasyJobFeatureLabel><Tooltip onOpenChange={open => { if (open) { try { setDiscovered(localStorage.getItem(storageKey) === 'seen'); } catch { /* optional discovery */ } } else markSeen(); }}><TooltipTrigger asChild><button type="button" aria-label={t('featureDetails')} className="rounded p-0.5 text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"><Info className="size-3.5" /></button></TooltipTrigger><TooltipContent><span>{companyId && entitlement.isPaid && (!discovered || help) ? `${t('includedWith')} ${entitlement.displayName}. ` : ''}{help || t('analysisFeatureHelp')}</span></TooltipContent></Tooltip></span>;
}
