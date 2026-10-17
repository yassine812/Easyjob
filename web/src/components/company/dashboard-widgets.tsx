'use client';
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useI18n } from '@/lib/i18n';
import { useDashboardText } from '@/lib/i18n/recruiter-dashboard';
import styles from './recruiter-dashboard.module.css';

const motionQuery = '(prefers-reduced-motion: reduce)';
const subscribeMotion = (listener: () => void) => {
  const query = window.matchMedia(motionQuery);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
};
export function useReducedMotion() { return useSyncExternalStore(subscribeMotion, () => window.matchMedia(motionQuery).matches, () => true); }

export function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const { locale } = useI18n();
  useEffect(() => {
    if (reduce || !ref.current) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 650);
      if (ref.current) ref.current.textContent = new Intl.NumberFormat(locale).format(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, locale, reduce]);
  return <span aria-label={new Intl.NumberFormat(locale).format(value)}><span ref={ref} aria-hidden="true">{new Intl.NumberFormat(locale).format(value)}</span></span>;
}

export function Trend({ value }: { value?: number | null }) {
  const { locale } = useI18n();
  const t = useDashboardText();
  if (value == null || !Number.isFinite(value)) return null;
  const Icon = value < 0 ? TrendingDown : TrendingUp;
  return <span className={styles.trend} data-negative={value < 0} title={t('comparison')}><Icon size={13} aria-hidden="true" />{value > 0 ? '+' : ''}{new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%</span>;
}

export function DashboardPanel({ title, icon: Icon, href, action, description, children, className = '' }: { title: ReactNode; icon?: LucideIcon; href?: string; action?: string; description?: string; children: ReactNode; className?: string }) {
  return <section className={`${styles.panel} ${className}`}><div className={styles.panelHeader}><div className={styles.minWidth}><h2>{Icon && <Icon size={18} aria-hidden="true" />}{title}</h2>{description && <p>{description}</p>}</div>{href && <Link href={href} className={styles.textLink}>{action}<ArrowRight size={13} aria-hidden="true" /></Link>}</div>{children}</section>;
}

export function KpiCard({ label, value, href, icon: Icon, color, trend, caption }: { label: string; value: number; href: string; icon: LucideIcon; color: string; trend?: number | null; caption: string }) {
  const t = useDashboardText();
  return <Link href={href} className={styles.kpi} style={{ '--accent': color } as CSSProperties}><span className={styles.kpiIcon}><Icon size={25} strokeWidth={1.6} /></span><div className={styles.minWidth}><p>{label}</p><div className={styles.kpiValue}><strong><AnimatedNumber value={value} /></strong><Trend value={trend} /></div><small>{trend == null ? caption : t('comparison')}</small></div><ArrowRight size={16} className={styles.kpiArrow} /></Link>;
}

export function ApplicationsChart({ daily }: { daily: { date: string; count: number }[] }) {
  const { locale } = useI18n();
  const t = useDashboardText();
  const reduced = useReducedMotion();
  const format = (date: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(date));
  if (!daily.some(day => day.count > 0)) return <div className={styles.chartEmpty}>{t('chartEmpty')}</div>;
  return <div className={styles.chart} role="group" aria-label={t('activityHelp')}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <ComposedChart data={daily} margin={{ top: 12, right: 10, left: -22, bottom: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
        <XAxis dataKey="date" tickFormatter={format} minTickGap={36} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={45} />
        <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.3 }} content={({ active, payload, label }) => active && payload?.length ? <div className={styles.chartTooltip}><time>{format(String(label))}</time><strong>{payload[0].value} {t('progress').toLocaleLowerCase(locale)}</strong></div> : null} />
        <Bar dataKey="count" fill="#7975f6" radius={[4, 4, 0, 0]} maxBarSize={28} fillOpacity={0.85} isAnimationActive={!reduced} animationDuration={650} />
        <Line dataKey="count" type="monotone" stroke="#b5b2ff" strokeWidth={2} dot={false} activeDot={{ r: 4 }} tooltipType="none" isAnimationActive={!reduced} animationDuration={750} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>;
}

export function DashboardSkeleton() {
  const t = useDashboardText();
  return <div className={styles.skeleton} role="status" aria-label={t('load')}><span className="sr-only">{t('load')}</span><div className={styles.kpis}>{[0, 1, 2, 3].map(i => <div key={i} className={styles.skeletonKpi} />)}</div><div className={styles.skeletonWide} /><div className={styles.chartGrid}><div /><div /></div><div className={styles.triple}>{[0, 1, 2].map(i => <div key={i} />)}</div></div>;
}

export function Avatar({ name }: { name: string }) { return <span className={styles.avatar} aria-hidden="true">{name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('')}</span>; }

export function RelativeDate({ date }: { date: string }) {
  const { locale } = useI18n();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { const tick = () => setNow(Date.now()); tick(); const id = setInterval(tick, 60000); return () => clearInterval(id); }, []);
  const time = new Date(date);
  const hours = now == null ? null : (time.getTime() - now) / 3600000;
  const label = hours == null ? time.toLocaleDateString(locale) : new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(Math.round(Math.abs(hours) < 24 ? hours : hours / 24), Math.abs(hours) < 24 ? 'hour' : 'day');
  return <time className={styles.relativeDate} dateTime={date} title={time.toLocaleString(locale)}>{label}</time>;
}
