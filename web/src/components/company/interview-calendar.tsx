'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import type { DatesSetArg, EventContentArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import frLocale from '@fullcalendar/core/locales/fr';
import arLocale from '@fullcalendar/core/locales/ar';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EasyJobLoader } from '@/components/ui/easyjob-loader';
import { Button } from '@/components/ui/button';
import type { InterviewRow } from '@/lib/api/company-workspace';
import { useI18n } from '@/lib/i18n';
import { useHiringText } from '@/lib/i18n/hiring';
import styles from './interview-calendar.module.css';

export const calendarViews = { month: 'dayGridMonth', week: 'timeGridWeek', day: 'timeGridDay', planning: 'listWeek' } as const;
type CalendarView = keyof typeof calendarViews;
type Screen = 'mobile' | 'portrait' | 'wide';
export const defaultCalendarView = (width: number, height: number): CalendarView => width < 640 ? 'planning' : width < 1024 && height > width ? 'day' : 'week';
const screenCategory = (): Screen => window.innerWidth < 640 ? 'mobile' : window.innerWidth < 1024 && window.innerHeight > window.innerWidth ? 'portrait' : 'wide';
export const statusColors: Record<string, string> = { IN_PROGRESS: '#0f8278', SCHEDULED: '#4563d7', CONFIRMED: '#0f8278', COMPLETED: '#39765b', CANCELLED: '#687182', NO_SHOW: '#956016' };
const zone = 'Africa/Tunis';
// FullCalendar's named-zone coercion expects local wall-clock strings without an offset.
export function tunisWallClock(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}
export function InterviewCalendarEvent({ item, view }: { item: InterviewRow; view: string }) {
  const { locale } = useI18n(), t = useHiringText();
  const minutes = (Date.parse(item.endAt) - Date.parse(item.startAt)) / 60000;
  const time = (value: string) => new Date(value).toLocaleTimeString(locale, { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false });
  const candidate = item.application.candidate.user.name;
  const job = item.application.job.title.replace(/\s*[—–-]+\s*$/, '').trim();
  const format = item.locationType === 'EASYJOB' ? 'EasyJob Meeting' : t(item.locationType ?? 'EXTERNAL');
  const isMonth = view === 'dayGridMonth', isAgenda = view === 'listWeek', isDay = view === 'timeGridDay';
  const interviewers = item.participants?.map(participant => participant.member.user.name).join(' · ');
  const tooltip = [candidate, job, `${time(item.startAt)}–${time(item.endAt)}`, t(item.type), format, t(item.status), interviewers].filter(Boolean).join('\n');
  if (isMonth) return <div className={styles.monthEvent} title={tooltip}><time>{time(item.startAt)}</time><strong>{candidate}</strong></div>;
  return <div className={styles.eventCard} data-day={isDay} data-agenda={isAgenda} data-short={minutes < 30} title={tooltip} aria-label={tooltip}>
    <time className={styles.eventTime}>{time(item.startAt)}–{time(item.endAt)}</time>
    <strong className={styles.eventCandidate}>{candidate}</strong>
    {(minutes >= 30 || isAgenda) && <span className={styles.eventRole}>{job}</span>}
    {(minutes > 60 || isAgenda || (isDay && minutes >= 45)) && <span className={styles.eventMeta}>{t(item.type)} · {format}</span>}
    {isDay && minutes >= 60 && interviewers && <span className={styles.eventInterviewers}>{interviewers}</span>}
    {isAgenda && <span className={styles.agendaStatus} style={{ color: statusColors[item.status] }}>{t(item.status)}</span>}
  </div>;
}

export function InterviewCalendar({ items, loading, onRange, onOpen, initialDate }: {
  items: InterviewRow[]; loading: boolean; onRange: (range: { from: string; to: string }) => void;
  onOpen: (id: string) => void; initialDate?: string;
}) {
  const { locale } = useI18n(), t = useHiringText();
  const calendar = useRef<FullCalendar>(null);
  const [selected, setSelected] = useState<CalendarView>('week');
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState('');
  const screen = useRef<Screen>('wide');
  useEffect(() => {
    const restore = () => {
      screen.current = screenCategory();
      let next = defaultCalendarView(window.innerWidth, window.innerHeight);
      try {
        const saved = localStorage.getItem(`easyjob.interviews.calendar.${screen.current}`);
        if (saved && Object.hasOwn(calendarViews, saved)) next = saved as CalendarView;
      } catch { /* Calendar navigation still works when storage is disabled. */ }
      setSelected(next);
      calendar.current?.getApi().changeView(calendarViews[next]);
      setReady(true);
    };
    restore();
    const resize = () => { if (screenCategory() !== screen.current) restore(); };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const chooseView = (next: CalendarView) => {
    setSelected(next);
    try { localStorage.setItem(`easyjob.interviews.calendar.${screen.current}`, next); } catch { /* Optional preference. */ }
    calendar.current?.getApi().changeView(calendarViews[next]);
  };
  const datesSet = useCallback((arg: DatesSetArg) => {
    setTitle(arg.view.title);
    // Tunis is UTC+01:00 for current scheduling dates; undo FC's UTC coercion at range boundaries.
    const from = new Date(`${arg.start.toISOString().slice(0, 19)}+01:00`).toISOString();
    const to = new Date(Date.parse(`${arg.end.toISOString().slice(0, 19)}+01:00`) - 1).toISOString();
    onRange({ from, to });
  }, [onRange]);
  const now = tunisWallClock(new Date().toISOString());
  const firstToday = items.filter(item => tunisWallClock(item.startAt).slice(0, 10) === now.slice(0, 10)).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))[0];
  const scrollHour = Math.max(8, Math.min(18, Number((firstToday ? tunisWallClock(firstToday.startAt) : now).slice(11, 13)) - 1));
  const scrollTime = `${String(scrollHour).padStart(2, '0')}:00:00`;
  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => calendar.current?.getApi().scrollToTime(scrollTime));
    return () => cancelAnimationFrame(frame);
  }, [ready, scrollTime]);
  return <section className={styles.calendar} aria-label={t('calendar')} aria-busy={loading}>
    <div className={styles.toolbar}>
      <div className={styles.dateNavigation}>
        <Button size="icon" variant="outline" aria-label={t('previous')} onClick={() => calendar.current?.getApi().prev()}><ChevronLeft className="size-4" /></Button>
        <Button size="icon" variant="outline" aria-label={t('next')} onClick={() => calendar.current?.getApi().next()}><ChevronRight className="size-4" /></Button>
        <Button variant="outline" onClick={() => calendar.current?.getApi().today()}>{t('calendarToday')}</Button>
      </div>
      <h2 className={styles.periodTitle} aria-live="polite">{title}</h2>
      <div className={styles.viewControl} role="group" aria-label={t('calendarViews')}>
        {(Object.keys(calendarViews) as CalendarView[]).map(key => <Button key={key} variant={selected === key ? 'default' : 'ghost'} aria-pressed={selected === key} onClick={() => chooseView(key)}>{t(`calendar${key[0].toUpperCase()}${key.slice(1)}`)}</Button>)}
      </div>
    </div>
    <div className={styles.calendarCaption}><span>{t('calendarTimezone')} : {zone}</span>{loading && <EasyJobLoader label={t('calendarLoading')} width={96} height={30} />}</div>
    {ready && <FullCalendar ref={calendar} plugins={[dayGridPlugin, timeGridPlugin, listPlugin]} locales={[frLocale, arLocale]} locale={locale}
      timeZone={zone} now={() => tunisWallClock(new Date().toISOString())} initialDate={initialDate || now.slice(0, 10)} initialView={calendarViews[selected]} headerToolbar={false}
      firstDay={1} datesSet={datesSet} height={680} slotMinTime="08:00:00" slotMaxTime="20:00:00" slotDuration="00:30:00" scrollTime={scrollTime}
      nowIndicator allDaySlot={false} eventMinHeight={0} eventShortHeight={0} slotEventOverlap={false}
      dayMaxEvents={3} eventDisplay="block" noEventsContent={t('noInterviews')}
      eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
      events={items.map(item => ({ id: item.id, start: tunisWallClock(item.startAt), end: tunisWallClock(item.endAt), title: item.application.candidate.user.name,
        backgroundColor: statusColors[item.status], borderColor: statusColors[item.status], extendedProps: { interview: item } }))}
      eventContent={(arg: EventContentArg) => <InterviewCalendarEvent item={arg.event.extendedProps.interview as InterviewRow} view={arg.view.type} />}
      eventClick={arg => onOpen(arg.event.id)} />}
  </section>;
}
