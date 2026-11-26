'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Progressive enhancement: content stays visible without observers or JavaScript. */
export function MotionSystem() {
  const pathname = usePathname();
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let intersection: IntersectionObserver | undefined;
    let mutations: MutationObserver | undefined;
    const seen = new WeakSet<Element>();
    const selector = '[data-motion-item], .motion-panel, [data-slot="card"], [data-users-list]';
    let order = 0;
    const disconnect = () => { intersection?.disconnect(); mutations?.disconnect(); };
    const setup = () => {
      disconnect();
      if (preference.matches || typeof window.IntersectionObserver !== 'function') return;
      intersection = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('motion-revealed');
          intersection?.unobserve(entry.target);
        }
      }, { threshold: 0.1 });
      const register = (root: ParentNode) => {
        const targets = [...root.querySelectorAll(selector)];
        if (root instanceof Element && root.matches(selector)) targets.unshift(root);
        for (const element of targets) {
          if (seen.has(element)) continue;
          seen.add(element);
          if (element instanceof HTMLElement) element.style.setProperty('--motion-order', String(order++ % 6));
          intersection?.observe(element);
        }
      };
      register(document);
      if (!('MutationObserver' in window)) return;
      mutations = new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) {
          if (node instanceof Element) register(node);
        }
      });
      mutations.observe(document.body, { childList: true, subtree: true });
    };
    setup();
    preference.addEventListener('change', setup);
    return () => { disconnect(); preference.removeEventListener('change', setup); };
  }, [pathname]);
  return null;
}
