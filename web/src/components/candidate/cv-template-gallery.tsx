'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Columns2, Expand, Minus, Plus } from 'lucide-react';
import { cvTemplates } from '@/lib/cv-designer';
import { useReleaseText } from '@/lib/i18n/release';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CvDesignerDocument, type CvDocumentProps } from './cv-designer-document';
import styles from './cv-designer.module.css';

function Miniature({ content, template, fontSize }: { content: string; template: string; fontSize: number }) {
  const host = useRef<HTMLDivElement>(null), [scale, setScale] = useState(.25);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 794));
    observer.observe(host.current); return () => observer.disconnect();
  }, []);
  return <div ref={host} aria-hidden="true" className={styles.miniature}><div className={styles.miniatureInner} style={{ transform: `scale(${scale})` }}><CvDesignerDocument content={content} template={template} fontSize={fontSize} miniature /></div></div>;
}

export function CvTemplateGallery({ content, template, fontSize, onSelect }: { content: string; template: string; fontSize: number; onSelect: (id: string) => void }) {
  const tr = useReleaseText(), [open, setOpen] = useState(false);
  function cards(expanded: boolean) {
    return cvTemplates.map((layout, index) => <button key={layout.id} type="button" aria-pressed={template === layout.id} aria-label={`${tr(layout.fr, layout.en, layout.ar)} · ${tr(layout.specialty[0], layout.specialty[1], layout.specialty[2])}`} onClick={() => { onSelect(layout.id); if (expanded) setOpen(false); }} className={`group min-w-0 rounded-xl border p-2 text-start transition-all hover:border-primary ${template === layout.id ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-background/40'}`}>
      <div className="relative"><Miniature content={content} template={layout.id} fontSize={fontSize} />{template === layout.id && <span className="absolute end-2 top-2 rounded-full bg-primary p-1 text-primary-foreground"><Check className="size-3" /></span>}</div>
      <div className="px-1 py-3"><p className="flex items-center justify-between text-sm font-semibold">{tr(layout.fr, layout.en, layout.ar)}<span className="text-[10px] font-normal text-muted-foreground">0{index + 1}</span></p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{tr(layout.specialty[0], layout.specialty[1], layout.specialty[2])}</p></div>
    </button>);
  }
  return <div className="space-y-4"><div><h3 className="text-sm font-semibold">{tr('Une vraie mise en page pour ton CV', 'A complete layout for your CV', 'تصميم متكامل لسيرتك')}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{tr('Aperçus de ta première page. Tes informations restent les mêmes.', 'Previews of your first page. Your information stays the same.', 'معاينة صفحتك الأولى بنفس معلوماتك.')}</p></div><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" className="w-full"><Expand className="me-2 size-4" />{tr('Comparer les modèles', 'Compare templates', 'مقارنة القوالب')}</Button></DialogTrigger><DialogContent className={styles.templateDialog}><DialogHeader><DialogTitle>{tr('Choisis ta signature professionnelle', 'Choose your professional style', 'اختر تصميمك المهني')}</DialogTitle><DialogDescription>{tr('Chaque aperçu utilise le contenu de ton CV. Sélectionne une mise en page pour l’appliquer.', 'Each preview uses your CV content. Select a layout to apply it.', 'كل معاينة تستخدم محتوى سيرتك. اختر تصميماً لتطبيقه.')}</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-4 md:grid-cols-3">{cards(true)}</div></DialogContent></Dialog><div className="grid grid-cols-2 gap-3">{cards(false)}</div></div>;
}

export function CvDocumentCanvas({ focusRequest, ...props }: CvDocumentProps & { focusRequest?: { index: number; sequence: number } }) {
  const tr = useReleaseText(), host = useRef<HTMLDivElement>(null), inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 794, height: 1123, availableHeight: 600 });
  const [zoom, setZoom] = useState<number | null>(null), [fit, setFit] = useState<'page' | 'width'>('width'), [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const area = host.current, sheet = inner.current;
    if (!area || !sheet) return;
    const measure = () => {
      const padding = (parseFloat(getComputedStyle(area).paddingLeft) || 0) * 2;
      setSize({ width: Math.max(80, area.clientWidth - padding), availableHeight: Math.max(112, area.clientHeight - padding), height: sheet.offsetHeight });
    };
    const observer = new ResizeObserver(measure);
    measure(); observer.observe(area); observer.observe(sheet); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', escape);
    return () => { if (overflow !== 'hidden') document.body.style.overflow = overflow; window.removeEventListener('keydown', escape); };
  }, [expanded]);
  const widthScale = Math.max(.1, size.width / 794);
  const scale = zoom ?? (fit === 'page' ? Math.min(widthScale, size.availableHeight / 1123) : widthScale);
  useEffect(() => {
    if (!focusRequest) return;
    const area = host.current, element = inner.current?.querySelector<HTMLElement>(`[data-cv-section="${focusRequest.index}"]`);
    if (!area || !element) return;
    element.focus({ preventScroll: true });
    const top = element.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop - 24;
    area.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [focusRequest, scale]);
  return <div className={expanded ? styles.expandedCanvas : styles.canvasShell}>
    <div className={styles.canvasToolbar}><span className="flex items-center gap-2 text-xs font-medium"><Columns2 className="size-4 text-primary" />A4</span>
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="icon" disabled={scale <= .15} aria-label={tr('Réduire', 'Zoom out', 'تصغير')} onClick={() => setZoom(Math.max(.15, scale - .1))}><Minus className="size-4" /></Button>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="icon" disabled={scale >= 2} aria-label={tr('Agrandir', 'Zoom in', 'تكبير')} onClick={() => setZoom(Math.min(2, scale + .1))}><Plus className="size-4" /></Button>
        <Button variant="ghost" size="sm" aria-pressed={zoom === null && fit === 'page'} onClick={() => { setZoom(null); setFit('page'); }}>{tr('Page entière', 'Fit page', 'صفحة كاملة')}</Button>
        <Button variant="ghost" size="sm" aria-pressed={zoom === null && fit === 'width'} onClick={() => { setZoom(null); setFit('width'); }}>{tr('Largeur', 'Fit width', 'العرض')}</Button>
        <Button variant="outline" size="sm" onClick={() => setExpanded(v => !v)}><Expand className="me-2 size-4" />{expanded ? tr('Fermer le plein écran', 'Exit fullscreen', 'إغلاق الشاشة الكاملة') : tr('Plein écran', 'Fullscreen', 'كامل الشاشة')}</Button>
      </div>
    </div>
    <div ref={host} className={styles.canvas}><div className={styles.sheetFrame} style={{ width: 794 * scale, height: Math.max(1123, size.height) * scale }}><div ref={inner} data-scale={scale} className={styles.sheetInner} style={{ transform: `scale(${scale})` }}><CvDesignerDocument {...props} /></div></div></div>
  </div>;
}
