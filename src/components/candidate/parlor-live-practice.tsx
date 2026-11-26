'use client';

import { useMemo, useState } from 'react';
import { Copy, Check, Video, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { env } from '@/config/env';
import type { CoachSession } from '@/lib/api/career';
import { useCoachCopy } from './interview-preparation';

/**
 * Optional Parlor bridge for the preparation step.
 *
 * Parlor is deliberately kept as a sidecar: it owns the local mic/camera and
 * its WebSocket/model lifecycle, while EasyJob remains the source of truth for
 * the scored interview session. This keeps the normal EasyJob coach usable
 * when the sidecar is not installed and avoids shipping multi-gigabyte models
 * in the web bundle.
 */
export function ParlorLivePractice({ session }: { session: CoachSession }) {
  const c = useCoachCopy();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const parlorUrl = useMemo(() => {
    const url = new URL(env.parlorUrl);
    // Parlor ignores unknown query parameters, but they make the browser tab
    // self-documenting and allow a future Parlor adapter to prefill context.
    url.searchParams.set('easyjob', '1');
    url.searchParams.set('role', session.jobTitle);
    if (session.company) url.searchParams.set('company', session.company);
    return url.toString();
  }, [session.company, session.jobTitle]);
  const prompt = useMemo(() => [
    'You are conducting a realistic mock job interview for EasyJob.',
    `Role: ${session.jobTitle}.`,
    session.company ? `Company: ${session.company}.` : '',
    `Ask one question at a time. Adapt follow-up questions to the candidate's answer.`,
    `Give concise spoken feedback after each answer, then continue until the candidate says stop.`,
  ].filter(Boolean).join(' '), [session.company, session.jobTitle]);
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* Clipboard permissions are optional; the text remains selectable. */ }
  };

  return <section className="overflow-hidden rounded-2xl border border-indigo-300/60 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 shadow-sm dark:border-indigo-800/70 dark:from-indigo-950/50 dark:via-slate-950 dark:to-cyan-950/30" aria-label={c('Pratique vocale Parlor', 'Parlor voice practice', 'تدريب صوتي Parlor')}>
    <div className="flex flex-wrap items-start justify-between gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"><Video size={19} aria-hidden="true" /></span>
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Parlor · open source</p><h2 className="mt-1 text-lg font-semibold">{c('Simulation vocale et vidéo', 'Live voice and video practice', 'محاكاة صوتية ومرئية مباشرة')}</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{c('Répète à l’oral avec le service Parlor configuré pour EasyJob. Après ton autorisation, le micro et la caméra lui transmettent les données nécessaires à la simulation.', 'Practise out loud with the Parlor service configured for EasyJob. After you grant permission, your microphone and camera send it the data needed for the simulation.', 'تدرب صوتياً مع خدمة Parlor المهيأة لـ EasyJob. بعد موافقتك، يرسل الميكروفون والكاميرا إليها البيانات اللازمة للمحاكاة.')}</p></div>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/70 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"><ShieldCheck size={14} aria-hidden="true" /> {c('Open source · service dédié', 'Open source · dedicated service', 'مفتوح المصدر · خدمة مخصصة')}</span>
    </div>
    <div className="grid gap-3 border-t border-indigo-200/60 p-5 dark:border-indigo-900/60 md:grid-cols-[1fr_auto] md:items-end">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c('Contexte à copier dans Parlor', 'Context to copy into Parlor', 'سياق لنسخه إلى Parlor')}</p><p className="mt-1 select-text rounded-lg border border-border/70 bg-background/70 p-3 text-sm leading-relaxed">{prompt}</p><p className="mt-2 text-xs text-muted-foreground">{c('Le contexte est copié uniquement quand tu cliques sur le bouton. Aucun CV ni réponse n’est envoyé automatiquement.', 'Context is copied only when you click the button. No CV or answer is sent automatically.', 'يتم نسخ السياق فقط عند النقر. لا يتم إرسال السيرة أو الإجابات تلقائياً.')}</p></div>
      <div className="flex flex-wrap gap-2 md:justify-end"><Button type="button" variant="outline" onClick={() => void copyPrompt()}><>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? c('Copié', 'Copied', 'تم النسخ') : c('Copier le contexte', 'Copy context', 'نسخ السياق')}</></Button><Button type="button" onClick={() => { setOpen(true); setLoaded(false); }}><Video size={16} /> {c('Ouvrir la pratique Parlor', 'Open Parlor practice', 'فتح تدريب Parlor')}</Button></div>
    </div>
    {open && <div className="relative border-t border-indigo-200/60 bg-slate-950 p-3 dark:border-indigo-900/60"><div className="mb-2 flex items-center justify-between gap-3 px-1 text-xs text-slate-300"><span role="status">{loaded ? c('Parlor est chargé · autorise le micro et la caméra dans la fenêtre.', 'Parlor is loaded · allow microphone and camera in the window.', 'تم تحميل Parlor · اسمح بالميكروفون والكاميرا في النافذة.') : c('Connexion à Parlor…', 'Connecting to Parlor…', 'جارٍ الاتصال بـ Parlor…')}</span><button type="button" className="rounded-md p-1 text-slate-300 hover:bg-white/10" onClick={() => setOpen(false)} aria-label={c('Fermer Parlor', 'Close Parlor', 'إغلاق Parlor')}><X size={16} /></button></div><iframe src={parlorUrl} title="Parlor live interview practice" allow="camera; microphone; autoplay" className="h-[min(70vh,640px)] min-h-[480px] w-full rounded-xl border border-slate-700 bg-slate-900" onLoad={() => setLoaded(true)} /></div>}
  </section>;
}
