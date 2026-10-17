import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CvPdfViewer } from './cv-pdf-viewer';
import type { Resume } from '@/types/api';

const pdf = vi.hoisted(() => ({ pages: 1, destroy: vi.fn() }));
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({ numPages: pdf.pages, getPage: async () => ({ getViewport: () => ({ width: 595, height: 842 }) }) }), destroy: pdf.destroy }) }));
vi.mock('@/lib/i18n/release', () => ({ useReleaseText: () => (fr: string) => fr }));
vi.mock('@/lib/i18n/career', () => ({ useCareerText: () => (key: string) => key }));
vi.mock('@/lib/i18n/ats', () => ({ useAtsText: () => (key: string) => key }));
vi.mock('@/lib/i18n/ux', () => ({ useUxText: () => (key: string) => key }));
vi.mock('@/components/ui/easyjob-loader', () => ({ EasyJobLoading: () => <div>EasyJob loader</div> }));
vi.mock('@/components/auth/easyjob-coach', () => ({ EasyJobCharacter: () => null }));
vi.mock('./cv-designer-document', () => ({ CvDesignerDocument: () => null }));
const resume = { id: 'submitted-snapshot', filename: 'CV-submitted.pdf', mimeType: 'application/pdf' } as Resume;
beforeEach(() => {
  pdf.pages = 1;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new TextEncoder().encode('%PDF-1.7').buffer }));
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  URL.createObjectURL = vi.fn(() => 'blob:submitted-cv'); URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('readable shared PDF viewer', () => {
  it.each([1,2,5])('stacks all %i pages at fit width with their natural A4 ratio', async count => {
    pdf.pages = count; const { container } = render(<CvPdfViewer resume={resume} sourceUrl="/submitted-file.pdf" />);
    await waitFor(() => expect(container.querySelectorAll('[data-pdf-page]')).toHaveLength(count));
    const first = container.querySelector<HTMLElement>('[data-pdf-page="1"]')!;
    expect(first.style.width).toBe('900px'); expect(parseFloat(first.style.height) / 900).toBeCloseTo(1.414, 2);
    expect(screen.getByRole('link', { name: 'download' })).toHaveAttribute('download', 'CV-submitted.pdf');
  });
  it('uses actual document percentage for zoom and restores fit width with Ctrl+0', async () => {
    const { container } = render(<CvPdfViewer resume={resume} sourceUrl="/submitted-file.pdf" />);
    await screen.findByRole('link', { name: 'download' });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Zoom' })).toBeInTheDocument());
    fireEvent.change(screen.getByRole('combobox', { name: 'Zoom' }), { target: { value: '1.5' } });
    expect(container.querySelector<HTMLElement>('[data-pdf-page]')!.style.width).toBe('893px');
    fireEvent.keyDown(screen.getByRole('region', { name: 'Ton CV interactif' }), { key: '0', ctrlKey: true });
    expect(container.querySelector<HTMLElement>('[data-pdf-page]')!.style.width).toBe('900px');
  });
  it('places close in the preview toolbar and closes the overlay', async () => {
    render(<CvPdfViewer resume={resume} sourceUrl="/submitted-file.pdf" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Prévisualiser le PDF' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('preserves the current page when the page geometry changes', async () => {
    pdf.pages = 5;
    const { container } = render(<CvPdfViewer resume={resume} sourceUrl="/submitted-file.pdf" />);
    await waitFor(() => expect(container.querySelectorAll('[data-pdf-page]')).toHaveLength(5));
    const scroller = container.querySelector<HTMLElement>('[data-pdf-scroll]')!;
    scroller.scrollTo = vi.fn();
    Object.defineProperty(container.querySelector('[data-pdf-page="5"]'), 'offsetTop', { value: 5000 });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Page du CV' }), { target: { value: '5' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Zoom' }), { target: { value: '1.5' } });
    expect(scroller.scrollTop).toBe(5000);
    expect(screen.getByRole('spinbutton', { name: 'Page du CV' })).toHaveValue(5);
  });
  it('provides retry and download on an invalid PDF', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    render(<CvPdfViewer resume={resume} sourceUrl="/submitted-file.pdf" />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'retry' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'download' })).toBeEnabled();
  });
});
