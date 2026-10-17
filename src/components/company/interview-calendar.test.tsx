import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InterviewCalendar, InterviewCalendarEvent, defaultCalendarView } from './interview-calendar';
import type { InterviewRow } from '@/lib/api/company-workspace';

vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));
vi.mock('@/lib/i18n/hiring', () => ({ useHiringText: () => (key: string) => ({ calendar: 'Calendrier', calendarMonth: 'Mois', calendarWeek: 'Semaine', calendarDay: 'Jour', calendarPlanning: 'Planning', calendarToday: 'Aujourd’hui', calendarViews: 'Vues du calendrier', noInterviews: 'Aucun entretien', CONFIRMED: 'Confirmé', TECHNICAL: 'Technique' } as Record<string, string>)[key] ?? key }));
const item: InterviewRow = { id: 'i1', applicationId: 'a1', startAt: '2026-10-06T10:21:00Z', endAt: '2026-10-06T11:06:00Z', type: 'TECHNICAL', status: 'CONFIRMED', locationType: 'EASYJOB', location: null, notes: null, application: { id: 'a1', candidate: { user: { name: 'Amel Ben Salem' } }, job: { title: 'Backend Developer —' } } };
const resize = (width: number, height: number) => { Object.defineProperty(window, 'innerWidth', { configurable: true, value: width }); Object.defineProperty(window, 'innerHeight', { configurable: true, value: height }); fireEvent(window, new Event('resize')); };
beforeEach(() => { localStorage.clear(); resize(1440, 1000); });
afterEach(cleanup);
function mount(items: InterviewRow[] = [item]) { const onOpen = vi.fn(), onRange = vi.fn(); return { ...render(<InterviewCalendar items={items} loading={false} onRange={onRange} onOpen={onOpen} initialDate="2026-10-06" />), onOpen, onRange }; }
describe('interview calendar navigation', () => {
  it('opens the actual week grid and exposes all four views', async () => {
    const { container } = mount();
    expect(screen.getByRole('button', { name: 'Semaine' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(container.querySelector('.fc-timeGridWeek-view')).toBeInTheDocument());
    for (const [name, selector] of [['Mois', '.fc-dayGridMonth-view'], ['Jour', '.fc-timeGridDay-view'], ['Planning', '.fc-listWeek-view'], ['Semaine', '.fc-timeGridWeek-view']]) {
      fireEvent.click(screen.getByRole('button', { name }));
      await waitFor(() => expect(container.querySelector(selector)).toBeInTheDocument());
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
    }
  });
  it('preserves the last selected view after remounting', () => {
    const first = mount(); fireEvent.click(screen.getByRole('button', { name: 'Mois' })); first.unmount();
    mount(); expect(screen.getByRole('button', { name: 'Mois' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('keeps navigation available when no interviews exist, including subsequent periods', async () => {
    const { onRange } = mount([]);
    fireEvent.click(screen.getByRole('button', { name: 'next' }));
    await waitFor(() => expect(onRange.mock.lastCall?.[0].from).toBe('2026-10-11T23:00:00.000Z'));
    fireEvent.click(screen.getByRole('button', { name: 'Planning' }));
    expect(screen.getByText('Aucun entretien')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'previous' })).toBeEnabled();
  });
  it('uses planning on mobile and day on portrait tablet without losing wide-screen preference', () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Mois' }));
    resize(390, 844); expect(screen.getByRole('button', { name: 'Planning' })).toHaveAttribute('aria-pressed', 'true');
    resize(834, 1112); expect(screen.getByRole('button', { name: 'Jour' })).toHaveAttribute('aria-pressed', 'true');
    resize(1440, 1000); expect(screen.getByRole('button', { name: 'Mois' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('opens the clicked interview', () => {
    const { onOpen } = mount(); fireEvent.click(screen.getByText('Amel Ben Salem')); expect(onOpen).toHaveBeenCalledWith('i1');
  });
  it.each([[390, 844, 'planning'], [834, 1112, 'day'], [1024, 768, 'week'], [1440, 900, 'week']])('selects a useful initial view at %sx%s', (w, h, view) => expect(defaultCalendarView(Number(w), Number(h))).toBe(view));
});
describe('duration-aware interview events', () => {
  it('shows three clean lines at 45 minutes and retains full hover information', () => {
    render(<InterviewCalendarEvent item={item} view="timeGridWeek" />);
    expect(screen.getByText('11:21–12:06')).toBeInTheDocument(); expect(screen.getByText('Amel Ben Salem')).toBeInTheDocument();
    expect(screen.getByText('Backend Developer')).toBeInTheDocument(); expect(screen.queryByText('Technique · EasyJob Meeting')).not.toBeInTheDocument();
    expect(screen.getByTitle(/Technique/)).toHaveAttribute('title', expect.stringContaining('EasyJob Meeting'));
  });
  it('omits the job for a short slot', () => {
    render(<InterviewCalendarEvent item={{ ...item, endAt: '2026-10-06T10:41:00Z' }} view="timeGridWeek" />);
    expect(screen.queryByText('Backend Developer')).not.toBeInTheDocument(); expect(screen.getByText('Amel Ben Salem')).toBeInTheDocument();
  });
  it('renders a compact month event and richer day and agenda events', () => {
    const { rerender } = render(<InterviewCalendarEvent item={item} view="dayGridMonth" />);
    expect(screen.getByText('11:21')).toBeInTheDocument(); expect(screen.queryByText('Backend Developer')).not.toBeInTheDocument();
    rerender(<InterviewCalendarEvent item={item} view="timeGridDay" />); expect(screen.getByText('Technique · EasyJob Meeting')).toBeInTheDocument();
    rerender(<InterviewCalendarEvent item={item} view="listWeek" />); expect(screen.getByText('Confirmé')).toBeInTheDocument();
  });
});
