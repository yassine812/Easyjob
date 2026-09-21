'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './guide-spotlight.module.css';

const targets = [
  '[data-guide="dashboard"]',
  'main .module-tabs',
  'main form',
  'main select',
  'main form',
  'main form',
];
type Box = { top: number; left: number; width: number; height: number };

export function GuideSpotlight({ step, href, label, children }: { step: number; href: string; label: string; children: ReactNode }) {
  const guide = useRef<HTMLElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [position, setPosition] = useState({ left: 16, top: 100 });

  useEffect(() => {
    let target: HTMLElement | null = null;
    let frame = 0;
    const update = () => {
      const candidates = [
        ...document.querySelectorAll<HTMLElement>(targets[step]),
        ...document.querySelectorAll<HTMLElement>(`a[href="${href}"]`),
      ];
      const next = candidates.find(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      if (next !== target) {
        target = next ?? null;
        if (target) {
          const r = target.getBoundingClientRect();
          if (r.top < 85 || r.bottom > window.innerHeight - 30) target.scrollIntoView?.({ block: 'center', behavior: 'instant' });
        }
      }
      const r = target?.getBoundingClientRect();
      const width = window.innerWidth, height = window.innerHeight;
      const b = r ? { left: Math.max(4, r.left - 8), top: Math.max(4, r.top - 8), width: Math.min(r.width + 16, width - Math.max(4, r.left - 8) - 4), height: Math.min(r.bottom + 8, height - 4) - Math.max(4, r.top - 8) } : null;
      setBox(previous => JSON.stringify(previous) === JSON.stringify(b) ? previous : b);
      const gw = guide.current?.offsetWidth || Math.min(500, width - 24);
      const gh = guide.current?.offsetHeight || 260;
      let left = width - gw - 24, top = height - gh - 24;
      if (b) {
        if (b.left + b.width + gw + 24 < width) { left = b.left + b.width + 20; top = b.top; }
        else if (b.top + b.height + gh + 24 < height) { left = b.left + b.width - gw; top = b.top + b.height + 18; }
        else if (b.top > gh + 24) { left = b.left + b.width - gw; top = b.top - gh - 18; }
      }
      setPosition({ left: Math.max(12, Math.min(left, width - gw - 12)), top: Math.max(12, Math.min(top, height - gh - 12)) });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    const observer = new MutationObserver(schedule);
    const main = document.querySelector('main');
    if (main) observer.observe(main, { childList: true, subtree: true });
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    if (guide.current) resize?.observe(guide.current);
    if (main) resize?.observe(main);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => { observer.disconnect(); resize?.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true); };
  }, [step, href]);

  return <>
    {box && box.height > 0 && <div data-testid="guide-spotlight" aria-hidden="true" className={styles.spotlight} style={box} />}
    <section ref={guide} role="region" aria-label={label} className={styles.guide} style={position}>{children}</section>
  </>;
}
