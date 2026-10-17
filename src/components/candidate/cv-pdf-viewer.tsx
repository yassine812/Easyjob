'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask, TextLayer } from 'pdfjs-dist';
import { Info, CheckCircle2, CircleAlert, ChevronLeft, ChevronRight, Download, ExternalLink, Maximize2, Minus, Plus, Star, Trash2, X } from 'lucide-react';
import { EasyJobLoading } from '@/components/ui/easyjob-loader';
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
import { CvDesignerDocument } from './cv-designer-document';

const EMPTY: AtsCriterion[] = [];
type Selection = { item: AtsCriterion; page?: number; excerpt?: string; passive?: boolean };
export type CvViewerActions = { onDownload: () => void; onPrimary: () => void; onDelete: () => void; pending?: boolean };

function DocumentPage({ doc, number, width, criteria, onSelect, onDismiss, onVisible }: {
  doc: PDFDocumentProxy; number: number; width: number; criteria: AtsCriterion[];
  onSelect: (selection: Selection) => void; onDismiss: () => void; onVisible: (page: number) => void;
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
  function activate(target: EventTarget | null, passive = false) {
    const span = target instanceof HTMLElement ? target.closest<HTMLElement>('[data-finding]') : null;
    const item = span && criteria[Number(span.dataset.finding)];
    if (item) { if (!passive) span?.focus(); onSelect({ item, page: number, excerpt: span?.textContent ?? '', passive }); }
  }
  return <div ref={host} data-pdf-page={number} className={styles.page} style={{ width, height: width * ratio }} aria-label={`${tr('Page', 'Page', 'صفحة')} ${number}`}>
    {near && <><canvas ref={canvas} aria-hidden="true" /><div ref={text} className={styles.textLayer} onPointerOut={e => { const from = (e.target as HTMLElement).closest?.('[data-finding]'); if (from && !from.contains(e.relatedTarget as Node | null)) onDismiss(); }} onBlur={onDismiss} onPointerOver={e => activate(e.target, true)} onFocus={e => activate(e.target, true)} onClick={e => activate(e.target)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(e.target); } }} /></>}
    {error && <p role="alert" className="absolute inset-0 grid place-items-center bg-white p-6 text-red-700">{tr('Impossible de rendre cette page. Recharge le document.', 'This page could not be rendered. Reload the document.', 'ما نجّمش نعرضوا الصفحة. عاود حمّل الملف.')}</p>}
  </div>;
}

export function CvPdfViewer({ resume, report, actions, fitPage = false, sourceUrl }: { resume: Resume; report?: AtsReport; actions?: CvViewerActions; fitPage?: boolean; sourceUrl?: string }) {
  return <PdfSession key={`${resume.id}:${resume.mimeType}:${sourceUrl ?? ''}`} resume={resume} report={report} actions={actions} fitPage={fitPage} sourceUrl={sourceUrl} />;
}

function PdfSession({ resume, report, actions, fitPage = false, sourceUrl }: { resume: Resume; report?: AtsReport; actions?: CvViewerActions; fitPage?: boolean; sourceUrl?: string }) {
  const tr = useReleaseText(), career = useCareerText(), ats = useAtsText();
  const frame = useRef<HTMLElement>(null), scroll = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null), [download, setDownload] = useState(''), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1), [available, setAvailable] = useState(900), [availableHeight, setAvailableHeight] = useState(600), [pageRatio, setPageRatio] = useState(1.414), [baseWidth, setBaseWidth] = useState(595), [zoom, setZoom] = useState(1), [fit, setFit] = useState<'width' | 'page' | 'custom'>(fitPage ? 'page' : 'width'), [previewOpen, setPreviewOpen] = useState(false);
  const currentPage = useRef(page);
  currentPage.current = page;
  const scrollResize = useRef<ResizeObserver | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [documentText, setDocumentText] = useState<string | null>(null);
  const criteria = report?.criteria ?? EMPTY;
  const isPdf = resume.mimeType?.toLowerCase().includes('pdf') || /\.pdf$/i.test(resume.filename);
  useEffect(() => {
    let disposed = false, url = '', task: ReturnType<typeof import('pdfjs-dist').getDocument> | undefined;
    const controller = new AbortController();
    void (async () => {
      const file = sourceUrl ? { url: sourceUrl } : await resumesApi.downloadUrl(resume.id);
      const response = await fetch(file.url, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new Error('Document unavailable');
      const buffer = await response.arrayBuffer();
      if (disposed) return;
      if (isPdf && !new TextDecoder().decode(buffer.slice(0, 1024)).includes('%PDF-')) throw new Error('Invalid PDF response');
      url = URL.createObjectURL(new Blob([buffer], { type: isPdf ? 'application/pdf' : resume.mimeType }));
      setDownload(url);
      if (!isPdf) { if (resume.mimeType.startsWith('text/')) setDocumentText(new TextDecoder().decode(buffer)); return; }
      const pdfjs = await import('pdfjs-dist');
      if (disposed) return;
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      task = pdfjs.getDocument({ data: new Uint8Array(buffer), cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/' });
      const loaded = await task.promise;
      const firstPage = await loaded.getPage(1);
      const size = firstPage.getViewport({ scale: 1 });
      if (!disposed) { setBaseWidth(size.width); setPageRatio(size.height / size.width); setDoc(loaded); }
    })().catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; controller.abort(); if (url) URL.revokeObjectURL(url); void task?.destroy(); };
  }, [resume.id, resume.mimeType, isPdf, retry, sourceUrl]);
  const attachScroll = useCallback((node: HTMLDivElement | null) => {
    scroll.current = node;
    scrollResize.current?.disconnect();
    if (!node) return;
    const resize = () => {
      if (!node.clientWidth) return;
      const css = getComputedStyle(node);
      const paddingX = (parseFloat(css.paddingLeft) || 0) + (parseFloat(css.paddingRight) || 0);
      const paddingY = (parseFloat(css.paddingTop) || 0) + (parseFloat(css.paddingBottom) || 0);
      setAvailable(Math.max(160, node.clientWidth - paddingX));
      setAvailableHeight(Math.max(160, node.clientHeight - paddingY));
    };
    resize();
    scrollResize.current = new ResizeObserver(resize);
    scrollResize.current.observe(node);
  }, []);
  const select = useCallback((value: Selection) => { setSelection(value); }, []);
  const dismiss = useCallback(() => { setSelection(null); }, []);
  useEffect(() => {
    if (!selection) return;
    if (!selection.passive) close.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [selection, dismiss]);
  const go = (n: number) => {
    const target = Math.max(1, Math.min(doc?.numPages ?? 1, n));
    setPage(target);
    const scroller = scroll.current, element = scroller?.querySelector(`[data-pdf-page="${target}"]`);
    if (scroller && element) scroller.scrollTo({ top: element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const width = Math.round(fit === 'custom' ? baseWidth * zoom : fit === 'page' ? Math.min(available, availableHeight / pageRatio) : Math.min(1050, available));
  useLayoutEffect(() => {
    const node = scroll.current;
    const target = node?.querySelector<HTMLElement>(`[data-pdf-page="${currentPage.current}"]`);
    if (node && target) node.scrollTop = target.offsetTop - node.offsetTop;
  }, [previewOpen, width]);
  const visibleZoom = width / baseWidth;
  const changeZoom = (value: number) => { setFit('custom'); setZoom(Math.max(.5, Math.min(2, value))); };
  function reload() {
    setDoc(null); setDownload(''); setFailed(false); setSelection(null); setPage(1); setRetry(n => n + 1);
  }
  const good = selection && isCvStrength(selection.item);
  const observationKey = selection?.item.key === 'quantified_evidence' && selection.item.metrics?.kind === 'scope' ? 'quantified_evidence_scope' : `${selection?.item.key}_${good ? 'pass' : 'fail'}`;
  const content = <section ref={frame} data-overlay={previewOpen} className={styles.viewer} tabIndex={0} onKeyDown={e => { if (!(e.ctrlKey || e.metaKey)) return; if (['+', '=', '-', '0'].includes(e.key)) { e.preventDefault(); if (e.key === '0') setFit('width'); else changeZoom(visibleZoom + (e.key === '-' ? -.25 : .25)); } }} aria-label={tr('Ton CV interactif', 'Your interactive CV', 'سيرتك التفاعلية')}>
    <div className={styles.documentTitle} title={resume.filename}>{resume.filename}</div>
    <div className={styles.toolbar}>
      <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" disabled={!doc || page <= 1} aria-label={career('previous')} onClick={() => go(page - 1)}><ChevronLeft className="size-4" /></Button>
      <label className="flex items-center gap-2 text-xs">{tr('Page', 'Page', 'صفحة')} <input aria-label={tr('Page du CV', 'CV page', 'صفحة السيرة')} type="number" min={1} max={doc?.numPages ?? 1} value={page} disabled={!doc} onChange={e => go(Number(e.target.value) || 1)} /> / {doc?.numPages ?? '—'}</label>
      <Button variant="ghost" size="sm" disabled={!doc || page >= doc.numPages} aria-label={career('next')} onClick={() => go(page + 1)}><ChevronRight className="size-4" /></Button>
      </div><div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" disabled={!doc || visibleZoom <= .5} aria-label={tr('Réduire', 'Zoom out', 'تصغير')} onClick={() => changeZoom(visibleZoom - .25)}><Minus className="size-4" /></Button><select className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs" aria-label={tr('Zoom', 'Zoom', 'تكبير')} value={fit === 'custom' ? String(zoom) : 'fit'} onChange={e => changeZoom(Number(e.target.value))}>{fit !== 'custom' && <option value="fit">{Math.round(visibleZoom * 100)}%</option>}{[.5,.75,1,1.25,1.5,2, ...(fit === 'custom' && ![.5,.75,1,1.25,1.5,2].includes(zoom) ? [zoom] : [])].sort((a,b)=>a-b).map(value => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}</select>
      <Button variant="ghost" size="sm" disabled={!doc || visibleZoom >= 2} aria-label={tr('Agrandir', 'Zoom in', 'تكبير')} onClick={() => changeZoom(visibleZoom + .25)}><Plus className="size-4" /></Button>
      </div><div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={() => { setFit('width'); setZoom(1); }}>{tr('Largeur', 'Fit width', 'العرض')}</Button><Button variant="ghost" size="sm" onClick={() => { setFit('page'); setZoom(1); }}>{tr('Page entière', 'Fit page', 'صفحة كاملة')}</Button>
      </div><div className="ms-auto flex flex-wrap items-center justify-end gap-1">{actions && <div className={styles.documentActions}><Button variant="outline" size="icon" disabled={actions.pending} onClick={actions.onPrimary} aria-label={career('setPrimary')} title={career('setPrimary')}><Star className="size-4" /></Button><Button variant="outline" size="icon" disabled={actions.pending} onClick={actions.onDelete} aria-label={career('delete')} title={career('delete')}><Trash2 className="size-4" /></Button></div>}<Button variant="ghost" size="sm" aria-label={tr('Plein écran', 'Fullscreen', 'كامل الشاشة')} onClick={() => { const request = document.fullscreenElement ? document.exitFullscreen() : frame.current?.requestFullscreen(); void request?.catch(() => undefined); }}><Maximize2 className="size-4" /></Button>{download && <><Button asChild variant="ghost" size="sm"><a href={download} download={resume.filename} aria-label={career('download')} title={career('download')}><Download className="size-4" /></a></Button>{isPdf && doc && !previewOpen && <Button variant="ghost" size="sm" onClick={() => { setPreviewOpen(true); }} aria-label={tr('Prévisualiser le PDF', 'Preview PDF', 'عاين PDF')} title={tr('Prévisualiser le PDF', 'Preview PDF', 'عاين PDF')}><ExternalLink className="size-4" /></Button>}</>}{previewOpen && <Button size="sm" variant="ghost" onClick={() => { setPreviewOpen(false); }} aria-label={tr('Fermer', 'Close', 'إغلاق')}><X className="size-4" /></Button>}</div>
    </div>
    {!!criteria.length && <div className={styles.legend}><span><CheckCircle2 className="size-4 text-emerald-400" />{tr('Point fort', 'Strength', 'نقطة قوة')}</span><span><CircleAlert className="size-4 text-amber-400" />{tr('À améliorer', 'To improve', 'يلزم تتحسّن')}</span><span>{tr('Survole ⓘ : ton coach t’explique.', 'Click a highlighted passage for an explanation from your coach.', 'انزل على النص الملوّن والمدرّب يفسّرلك.')}</span></div>}
    <div ref={attachScroll} className={styles.scroll} data-pdf-scroll>
      {failed ? <div role="alert" className="p-10 text-center text-slate-200"><p>{tr('Impossible de charger le document original.', 'Could not load the original document.', 'ما نجّمش نحمّلوا PDF الأصلي.')}</p><div className="mt-4 flex justify-center gap-3"><Button onClick={reload}>{career('retry')}</Button><Button variant="outline" onClick={async () => { const file = download || sourceUrl || (await resumesApi.downloadUrl(resume.id)).url; const link = document.createElement('a'); link.href = file; link.download = resume.filename; link.click(); }}>{career('download')}</Button></div></div> : !isPdf && documentText !== null ? <div className="w-full p-5"><CvDesignerDocument content={documentText} template={resume.design?.template ?? "classic"} fontSize={resume.design?.fontSize ?? 14} report={report} onFinding={item => select({ item, passive: true })} onFindingEnd={dismiss} /></div> : !isPdf ? <p className="p-8 text-slate-200">{tr('Télécharge ce document pour le lire. Importe un PDF pour activer les surlignages.', 'Download this document to read it. Upload a PDF to enable highlights.', 'نزّل الوثيقة باش تقراها. حمّل PDF باش تفعّل التلوين.')}</p> : !doc ? <div className={styles.skeleton}><EasyJobLoading /></div> : Array.from({ length: doc.numPages }, (_, i) => <DocumentPage key={i} doc={doc} number={i + 1} width={width} criteria={criteria} onSelect={select} onDismiss={dismiss} onVisible={setPage} />)}
    </div>
    {!!criteria.length && <details className="border-t border-slate-700 p-4 text-sm text-slate-200"><summary className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-indigo-300">{tr('Tous les constats ATS', 'All ATS findings', 'ملاحظات ATS الكلّ')} · {criteria.length}</summary><p className="my-3 text-xs text-slate-400">{tr('Les éléments absents ou sans passage repérable sont expliqués ici.', 'Missing items or findings without a locatable passage are explained here.', 'الحاجات الناقصة ولا اللي ما لقيناش مكانها تتفسّر هنا.')}</p><div className="flex flex-wrap gap-2">{criteria.map(item => <button key={item.key} className="flex items-center gap-2 rounded-full border border-slate-600 px-3 py-2 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-indigo-300" onClick={() => select({ item })}>{isCvStrength(item) ? <CheckCircle2 className="size-4 text-emerald-400" /> : <CircleAlert className="size-4 text-amber-400" />}{career(item.key)}<Info className="size-3.5" /></button>)}</div></details>}

    {selection && <div className={styles.coach}><div className={styles.character}><EasyJobCharacter floating pose={good ? 2 : 1} /></div><div className={styles.bubble} role="dialog" aria-modal="false" aria-label={career(selection.item.key)}><button ref={close} type="button" onClick={dismiss} className="float-end rounded p-1 hover:bg-white/10 focus-visible:outline-2" aria-label={tr('Fermer', 'Close', 'سكّر')}><X className="size-4" /></button><span className={`text-xs font-semibold ${good ? 'text-emerald-300' : 'text-amber-300'}`}>{good ? tr('Bien joué !', 'Well done!', 'برافو!') : ats(selection.item.priority ?? 'medium')}{selection.page ? ` · ${tr('Page', 'Page', 'صفحة')} ${selection.page}` : ''}</span><h3 className="mt-2 font-semibold">{career(selection.item.key)}</h3><p>{ats(observationKey, { count: selection.item.metrics?.count ?? '' }) || ats(good ? 'fallback_pass' : 'fallback_fail')}</p>{selection.excerpt && <blockquote>{selection.excerpt}</blockquote>}{!good && <p>{ats(`${selection.item.key}_action`) || ats('fallback_action')}</p>}</div></div>}
  </section>;
  return previewOpen ? <Dialog open onOpenChange={open => { setPreviewOpen(open); }}><DialogContent showCloseButton={false} className="!top-1/2 !w-[min(96vw,1400px)] !max-w-none !-translate-y-1/2 !p-0 overflow-hidden bg-slate-950" style={{ height: '94dvh', display: 'flex', flexDirection: 'column' }}><DialogTitle className="sr-only">{resume.filename}</DialogTitle><DialogDescription className="sr-only">{tr('Aperçu du CV', 'CV preview', 'معاينة السيرة')}</DialogDescription>{content}</DialogContent></Dialog> : content;
}
