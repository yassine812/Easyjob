'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask, TextLayer } from 'pdfjs-dist';
import { CheckCircle2, CircleAlert, ChevronLeft, ChevronRight, Download, ExternalLink, Maximize2, Minus, Plus, Star, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { EasyJobCharacter } from '@/components/auth/easyjob-coach';
import { resumesApi } from '@/lib/api/resumes';
import type { AtsCriterion, AtsReport } from '@/lib/api/career';
import { useCareerText } from '@/lib/i18n/career';
import { useAtsText } from '@/lib/i18n/ats';
import { useReleaseText } from '@/lib/i18n/release';
import { isCvStrength, matchCvEvidence } from '@/lib/cv-highlights';
import type { Resume } from '@/types/api';
import styles from './cv-pdf-viewer.module.css';

const EMPTY: AtsCriterion[] = [];
type Selection = { item: AtsCriterion; page?: number; excerpt?: string };
export type CvViewerActions = { onDownload: () => void; onPrimary: () => void; onDelete: () => void; pending?: boolean };

function DocumentPage({ doc, number, width, criteria, onSelect, onVisible }: {
  doc: PDFDocumentProxy; number: number; width: number; criteria: AtsCriterion[];
  onSelect: (selection: Selection) => void; onVisible: (page: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), text = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false), [ratio, setRatio] = useState(1.414), [error, setError] = useState(false);
  const career = useCareerText(), tr = useReleaseText();
  const labelsKey = JSON.stringify(criteria.map(c => `${career(c.key)} — ${isCvStrength(c) ? tr('Point fort', 'Strength', 'نقطة قوة') : tr('À améliorer', 'To improve', 'يلزم تتحسّن')}`));
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => setNear(entries[0].isIntersecting), { root: node.closest('[data-pdf-scroll]'), rootMargin: '650px' });
    const visible = new IntersectionObserver(entries => { if (entries[0].isIntersecting) onVisible(number); }, { root: node.closest('[data-pdf-scroll]'), rootMargin: '-25% 0px -60% 0px', threshold: 0 });
    observer.observe(node); visible.observe(node);
    return () => { observer.disconnect(); visible.disconnect(); };
  }, [number, onVisible]);
  useEffect(() => {
    if (!near || !canvas.current || !text.current) return;
    let cancelled = false, render: RenderTask | undefined, layer: TextLayer | undefined;
    const surface = canvas.current, textHost = text.current;
    void (async () => {
      const pdfjs = await import('pdfjs-dist');
      const page = await doc.getPage(number);
      if (cancelled) return;
      setError(false);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / base.width });
      const content = await page.getTextContent();
      if (cancelled) return;
      setRatio(viewport.height / viewport.width);
      const resolution = Math.min(window.devicePixelRatio || 1, 2);
      surface.width = Math.floor(viewport.width * resolution); surface.height = Math.floor(viewport.height * resolution);
      textHost.replaceChildren();
      textHost.style.setProperty('--total-scale-factor', String(viewport.scale));
      textHost.style.setProperty('--scale-factor', String(viewport.scale));
      render = page.render({ canvas: surface, viewport, transform: [resolution, 0, 0, resolution, 0, 0] });
      layer = new pdfjs.TextLayer({ textContentSource: content, container: textHost, viewport });
      await Promise.all([render.promise, layer.render()]);
      if (cancelled) return;
      const labels: string[] = JSON.parse(labelsKey);
      matchCvEvidence(layer.textContentItemsStr, criteria).forEach((item, index) => {
        const span = layer!.textDivs[index];
        if (!span) return;
        span.dataset.finding = String(criteria.indexOf(item));
        span.dataset.tone = isCvStrength(item) ? 'good' : item.priority === 'high' ? 'high' : 'bad';
        span.tabIndex = 0; span.setAttribute('role', 'button');
        span.setAttribute('aria-label', `${labels[criteria.indexOf(item)]}: ${span.textContent}`);
        span.setAttribute('aria-haspopup', 'dialog');
      });
    })().catch(err => { if (!cancelled && err?.name !== 'RenderingCancelledException') setError(true); });
    return () => { cancelled = true; render?.cancel(); layer?.cancel(); textHost.replaceChildren(); surface.width = 0; surface.height = 0; };
  }, [doc, number, width, near, criteria, labelsKey]);
  function activate(target: EventTarget | null) {
    const span = target instanceof HTMLElement ? target.closest<HTMLElement>('[data-finding]') : null;
    const item = span && criteria[Number(span.dataset.finding)];
    if (item) { span?.focus(); onSelect({ item, page: number, excerpt: span?.textContent ?? '' }); }
  }
  return <div ref={host} data-pdf-page={number} className={styles.page} style={{ width, height: width * ratio }} aria-label={`${tr('Page', 'Page', 'صفحة')} ${number}`}>
    {near && <><canvas ref={canvas} aria-hidden="true" /><div ref={text} className={styles.textLayer} onClick={e => activate(e.target)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(e.target); } }} /></>}
    {error && <p role="alert" className="absolute inset-0 grid place-items-center bg-white p-6 text-red-700">{tr('Impossible de rendre cette page. Recharge le document.', 'This page could not be rendered. Reload the document.', 'ما نجّمش نعرضوا الصفحة. عاود حمّل الملف.')}</p>}
  </div>;
}

export function CvPdfViewer({ resume, report, actions }: { resume: Resume; report?: AtsReport; actions?: CvViewerActions }) {
  return <PdfSession key={`${resume.id}:${resume.mimeType}`} resume={resume} report={report} actions={actions} />;
}

function PdfSession({ resume, report, actions }: { resume: Resume; report?: AtsReport; actions?: CvViewerActions }) {
  const tr = useReleaseText(), career = useCareerText(), ats = useAtsText();
  const frame = useRef<HTMLElement>(null), scroll = useRef<HTMLDivElement>(null), previewScroll = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null), trigger = useRef<HTMLElement | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null), [download, setDownload] = useState(''), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1), [available, setAvailable] = useState(900), [availableHeight, setAvailableHeight] = useState(600), [pageRatio, setPageRatio] = useState(1.414), [zoom, setZoom] = useState(1), [fit, setFit] = useState<'width' | 'page'>('width'), [previewOpen, setPreviewOpen] = useState(false), [previewPage, setPreviewPage] = useState(1), [previewWidth, setPreviewWidth] = useState(900);
  const [selection, setSelection] = useState<Selection | null>(null);
  const criteria = report?.criteria ?? EMPTY;
  const isPdf = resume.mimeType?.toLowerCase().includes('pdf') || /\.pdf$/i.test(resume.filename);
  useEffect(() => {
    let disposed = false, url = '', task: ReturnType<typeof import('pdfjs-dist').getDocument> | undefined;
    const controller = new AbortController();
    void (async () => {
      const file = await resumesApi.downloadUrl(resume.id);
      const response = await fetch(file.url, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new Error('Document unavailable');
      const buffer = await response.arrayBuffer();
      if (disposed) return;
      if (isPdf && !new TextDecoder().decode(buffer.slice(0, 1024)).includes('%PDF-')) throw new Error('Invalid PDF response');
      url = URL.createObjectURL(new Blob([buffer], { type: isPdf ? 'application/pdf' : resume.mimeType }));
      setDownload(url);
      if (!isPdf) return;
      const pdfjs = await import('pdfjs-dist');
      if (disposed) return;
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      task = pdfjs.getDocument({ data: new Uint8Array(buffer), cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/' });
      const loaded = await task.promise;
      const firstPage = await loaded.getPage(1);
      const size = firstPage.getViewport({ scale: 1 });
      if (!disposed) { setPageRatio(size.height / size.width); setDoc(loaded); }
    })().catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; controller.abort(); if (url) URL.revokeObjectURL(url); void task?.destroy(); };
  }, [resume.id, resume.mimeType, isPdf, retry]);
  useEffect(() => {
    const node = scroll.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      setAvailable(Math.max(200, node.clientWidth));
      setAvailableHeight(Math.max(200, node.clientHeight - (window.innerWidth < 640 ? 24 : 56)));
    });
    observer.observe(node); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!previewOpen) return;
    const node = previewScroll.current;
    if (!node) return;
    const resize = () => setPreviewWidth(Math.max(200, node.clientWidth));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [previewOpen]);
  const select = useCallback((value: Selection) => { trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setSelection(value); }, []);
  const dismiss = useCallback(() => { setSelection(null); trigger.current?.focus(); }, []);
  useEffect(() => {
    if (!selection) return;
    close.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [selection, dismiss]);
  const go = (n: number) => {
    const target = Math.max(1, Math.min(doc?.numPages ?? 1, n));
    setPage(target);
    const scroller = scroll.current, element = scroller?.querySelector(`[data-pdf-page="${target}"]`);
    if (scroller && element) scroller.scrollTo({ top: element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const width = Math.round((fit === 'page' ? Math.min(available, availableHeight / pageRatio) : available) * zoom);
  function reload() {
    setDoc(null); setDownload(''); setFailed(false); setSelection(null); setPage(1); setRetry(n => n + 1);
  }
  const good = selection && isCvStrength(selection.item);
  const observationKey = selection?.item.key === 'quantified_evidence' && selection.item.metrics?.kind === 'scope' ? 'quantified_evidence_scope' : `${selection?.item.key}_${good ? 'pass' : 'fail'}`;
  return <section ref={frame} className={styles.viewer} aria-label={tr('Ton CV interactif', 'Your interactive CV', 'سيرتك التفاعلية')}>
    <div className={styles.toolbar}>
      <Button variant="ghost" size="sm" disabled={!doc || page <= 1} aria-label={career('previous')} onClick={() => go(page - 1)}><ChevronLeft className="size-4" /></Button>
      <label className="flex items-center gap-2 text-xs">{tr('Page', 'Page', 'صفحة')} <input aria-label={tr('Page du CV', 'CV page', 'صفحة السيرة')} type="number" min={1} max={doc?.numPages ?? 1} value={page} disabled={!doc} onChange={e => go(Number(e.target.value) || 1)} /> / {doc?.numPages ?? '—'}</label>
      <Button variant="ghost" size="sm" disabled={!doc || page >= doc.numPages} aria-label={career('next')} onClick={() => go(page + 1)}><ChevronRight className="size-4" /></Button>
      <Button variant="ghost" size="sm" disabled={!doc || zoom <= .5} aria-label={tr('Réduire', 'Zoom out', 'تصغير')} onClick={() => setZoom(z => Math.max(.5, z - .1))}><Minus className="size-4" /></Button><span className="text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
      <Button variant="ghost" size="sm" disabled={!doc || zoom >= 2} aria-label={tr('Agrandir', 'Zoom in', 'تكبير')} onClick={() => setZoom(z => Math.min(2, z + .1))}><Plus className="size-4" /></Button>
      <Button variant="ghost" size="sm" onClick={() => { setFit('width'); setZoom(1); }}>{tr('Largeur', 'Fit width', 'العرض')}</Button><Button variant="ghost" size="sm" onClick={() => { setFit('page'); setZoom(1); }}>{tr('Page entière', 'Fit page', 'صفحة كاملة')}</Button>
      <div className="ms-auto flex flex-wrap items-center justify-end gap-1"><div className={styles.documentActions}>{actions && <><Button variant="outline" size="icon" disabled={actions.pending} onClick={actions.onDownload} aria-label={career('download')} title={career('download')}><Download className="size-4" /></Button><Button variant="outline" size="icon" disabled={actions.pending} onClick={actions.onPrimary} aria-label={career('setPrimary')} title={career('setPrimary')}><Star className="size-4" /></Button><Button variant="outline" size="icon" disabled={actions.pending} onClick={actions.onDelete} aria-label={career('delete')} title={career('delete')}><Trash2 className="size-4" /></Button></>}</div><Button variant="ghost" size="sm" aria-label={tr('Plein écran', 'Fullscreen', 'كامل الشاشة')} onClick={() => { const request = document.fullscreenElement ? document.exitFullscreen() : frame.current?.requestFullscreen(); void request?.catch(() => undefined); }}><Maximize2 className="size-4" /></Button>{download && <><Button asChild variant="ghost" size="sm"><a href={download} download={resume.filename} aria-label={career('download')} title={career('download')}><Download className="size-4" /></a></Button>{isPdf && doc && <Button variant="ghost" size="sm" onClick={() => { setPreviewPage(page); setPreviewOpen(true); }} aria-label={tr('Prévisualiser le PDF', 'Preview PDF', 'عاين PDF')} title={tr('Prévisualiser le PDF', 'Preview PDF', 'عاين PDF')}><ExternalLink className="size-4" /></Button>}</>}</div>
    </div>
    <div className={styles.legend}><span><CheckCircle2 className="size-4 text-emerald-400" />{tr('Point fort', 'Strength', 'نقطة قوة')}</span><span><CircleAlert className="size-4 text-amber-400" />{tr('À améliorer', 'To improve', 'يلزم تتحسّن')}</span><span>{tr('Clique sur un passage surligné : ton coach t’explique.', 'Click a highlighted passage for an explanation from your coach.', 'انزل على النص الملوّن والمدرّب يفسّرلك.')}</span></div>
    <div ref={scroll} className={styles.scroll} data-pdf-scroll>
      {failed ? <div role="alert" className="p-10 text-center text-slate-200"><p>{tr('Impossible de charger le PDF original.', 'Could not load the original PDF.', 'ما نجّمش نحمّلوا PDF الأصلي.')}</p><Button className="mt-4" onClick={reload}>{career('retry')}</Button></div> : !isPdf ? <p className="p-8 text-slate-200">{tr('Télécharge ce document pour le lire. Importe un PDF pour activer les surlignages.', 'Download this document to read it. Upload a PDF to enable highlights.', 'نزّل الوثيقة باش تقراها. حمّل PDF باش تفعّل التلوين.')}</p> : !doc ? <p role="status" className="p-16 text-center text-slate-300">{tr('Ouverture de ton CV…', 'Opening your CV…', 'نحلّوا في سيرتك…')}</p> : Array.from({ length: doc.numPages }, (_, i) => <DocumentPage key={i} doc={doc} number={i + 1} width={width} criteria={criteria} onSelect={select} onVisible={setPage} />)}
    </div>
    {!!criteria.length && <details className="border-t border-slate-700 p-4 text-sm text-slate-200"><summary className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-indigo-300">{tr('Tous les constats ATS', 'All ATS findings', 'ملاحظات ATS الكلّ')} · {criteria.length}</summary><p className="my-3 text-xs text-slate-400">{tr('Les éléments absents ou sans passage repérable sont expliqués ici.', 'Missing items or findings without a locatable passage are explained here.', 'الحاجات الناقصة ولا اللي ما لقيناش مكانها تتفسّر هنا.')}</p><div className="flex flex-wrap gap-2">{criteria.map(item => <button key={item.key} className="flex items-center gap-2 rounded-full border border-slate-600 px-3 py-2 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-indigo-300" onClick={() => select({ item })}>{isCvStrength(item) ? <CheckCircle2 className="size-4 text-emerald-400" /> : <CircleAlert className="size-4 text-amber-400" />}{career(item.key)}</button>)}</div></details>}
    {doc && <Dialog open={previewOpen} onOpenChange={setPreviewOpen}><DialogContent className="!top-1/2 !w-[min(96vw,1400px)] !max-w-none !-translate-y-1/2 !p-0 overflow-hidden bg-slate-950"><div className="flex h-[92vh] min-h-0 flex-col"><div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-2 text-slate-100"><DialogTitle>{tr('Prévisualisation du CV', 'CV preview', 'معاينة السيرة')}</DialogTitle><DialogDescription className="sr-only">{tr('Une page du CV à la fois.', 'One CV page at a time.', 'صفحة واحدة من السيرة في كل مرة.')}</DialogDescription><div className="flex items-center gap-2"><Button variant="ghost" size="icon" disabled={previewPage <= 1} onClick={() => setPreviewPage(n => Math.max(1, n - 1))} aria-label={career('previous')}><ChevronLeft className="size-4" /></Button><span className="min-w-16 text-center text-xs">{previewPage} / {doc.numPages}</span><Button variant="ghost" size="icon" disabled={previewPage >= doc.numPages} onClick={() => setPreviewPage(n => Math.min(doc.numPages, n + 1))} aria-label={career('next')}><ChevronRight className="size-4" /></Button></div></div><div ref={previewScroll} className={styles.previewScroll} data-pdf-scroll><DocumentPage key={`preview-${previewPage}`} doc={doc} number={previewPage} width={previewWidth} criteria={criteria} onSelect={select} onVisible={setPage} /></div></div></DialogContent></Dialog>}
    {selection && <div className={styles.coach}><div className={styles.character}><EasyJobCharacter floating pose={good ? 2 : 1} /></div><div className={styles.bubble} role="dialog" aria-modal="false" aria-label={career(selection.item.key)}><button ref={close} type="button" onClick={dismiss} className="float-end rounded p-1 hover:bg-white/10 focus-visible:outline-2" aria-label={tr('Fermer', 'Close', 'سكّر')}><X className="size-4" /></button><span className={`text-xs font-semibold ${good ? 'text-emerald-300' : 'text-amber-300'}`}>{good ? tr('Bien joué !', 'Well done!', 'برافو!') : ats(selection.item.priority ?? 'medium')}{selection.page ? ` · ${tr('Page', 'Page', 'صفحة')} ${selection.page}` : ''}</span><h3 className="mt-2 font-semibold">{career(selection.item.key)}</h3><p>{ats(observationKey, { count: selection.item.metrics?.count ?? '' }) || ats(good ? 'fallback_pass' : 'fallback_fail')}</p>{selection.excerpt && <blockquote>{selection.excerpt}</blockquote>}{!good && <p>{ats(`${selection.item.key}_action`) || ats('fallback_action')}</p>}</div></div>}
  </section>;
}
