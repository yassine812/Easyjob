'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';

import { useUxText } from '@/lib/i18n/ux';

export function AnalysisProcessing() {
  const t = useUxText();
  return <div role="status" className="ai-surface space-y-3 p-4"><p className="flex items-center gap-2 text-sm font-medium"><EasyJobFeatureMark size="sm" aria-hidden="true" className=" text-primary" />{t('processing')}</p><p className="text-xs text-muted-foreground">{t('analysisInputs')}</p><div className="processing-line" aria-hidden="true" /><p className="text-xs leading-5 text-muted-foreground">{t('processingHelp')}</p></div>;
}
