'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { careerApi } from '@/lib/api/career';
import { useCareerText } from '@/lib/i18n/career';

/** Free employer navigation is independent of the paid preparation workspace. */
export function ExternalApplyButton({ jobId, className = '' }: { jobId: string; className?: string }) {
  const [pending, setPending] = useState(false);
  const t = useCareerText();
  const open = async () => {
    setPending(true);
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const result = await careerApi.openExternalApplication(jobId);
      if (tab) tab.location.href = result.applicationUrl; else window.location.assign(result.applicationUrl);
    } catch { tab?.close(); toast.error(t('error')); }
    finally { setPending(false); }
  };
  return <Dialog><DialogTrigger asChild><Button size="lg" variant="outline" className={`inline-flex h-12 min-h-12 items-center justify-center gap-2 leading-none ${className}`}><ExternalLink className="size-4 shrink-0" />{t('continueToEmployer')}</Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>{t('continueToEmployer')}</DialogTitle><DialogDescription>{t('externalApplicationDisclosure')}</DialogDescription></DialogHeader>
      <Button disabled={pending} onClick={() => void open()}>{pending ? t('loading') : t('continueToEmployer')}</Button>
    </DialogContent></Dialog>;
}
