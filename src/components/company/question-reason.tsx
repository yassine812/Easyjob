'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { presentQuestionReason, type QuestionReason as Reason } from '@/lib/interview-reason';
import { EasyJobFeatureLabel } from '@/components/ui/easyjob-feature-mark';

export function QuestionReason({ reason }: { reason?: Reason | null }) {
  const { locale } = useI18n();
  const [showEvidence, setShowEvidence] = useState(false);
  const copy = presentQuestionReason(reason, locale);
  return <div className="mt-2 min-w-0 text-xs text-muted-foreground" dir={locale === 'ar' ? 'rtl' : undefined}>
    <div className="mb-2 flex flex-wrap gap-1.5"><span className="rounded-md bg-muted px-2 py-1 text-[11px]">{copy.tag}</span>{copy.importance && <span className="rounded-md bg-muted px-2 py-1 text-[11px]">{copy.importance}</span>}</div>
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded py-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"><EasyJobFeatureLabel>{copy.why}</EasyJobFeatureLabel><ChevronDown aria-hidden="true" className="size-3 shrink-0 transition-transform group-open:rotate-180" /></summary>
      <div className="mt-2 rounded-lg bg-muted p-3 text-xs leading-6 break-words"><p>{copy.text}</p>
        {copy.sourceLabels.length > 0 && <p className="mt-2 text-[11px]">{copy.sources} : {copy.sourceLabels.join(' · ')}</p>}
        {copy.excerpts.length > 0 && <><button type="button" className="mt-2 text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" aria-expanded={showEvidence} onClick={() => setShowEvidence(value => !value)}>{copy.evidence}</button>{showEvidence && copy.excerpts.map((excerpt, index) => <blockquote key={index} className="mt-3 border-s-2 border-border ps-2"><cite className="font-semibold not-italic">{excerpt.source}</cite><p>{excerpt.text}</p></blockquote>)}</>}
      </div>
    </details>
  </div>;
}
