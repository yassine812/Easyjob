import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MotionSystem } from './motion-system';

vi.mock('next/navigation', () => ({ usePathname: () => '/candidate/dashboard' }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function installObservers(reduced = false) {
  const observe = vi.fn(), unobserve = vi.fn(), disconnect = vi.fn();
  let onIntersect: IntersectionObserverCallback = () => {};
  const factory = vi.fn(function(callback: IntersectionObserverCallback) {
    onIntersect = callback;
    return { observe, unobserve, disconnect };
  });
  vi.stubGlobal('IntersectionObserver', factory);
  vi.stubGlobal('matchMedia', vi.fn(() => ({matches: reduced, addEventListener:vi.fn(), removeEventListener:vi.fn()})));
  return { factory, observe, unobserve, disconnect, reveal: (target:Element) => onIntersect([{target,isIntersecting:true} as IntersectionObserverEntry], {} as IntersectionObserver) };
}

it('keeps content visible when reduced motion is preferred, without starting observers', () => {
  const observer=installObservers(true);
  render(<><MotionSystem /><h1 data-motion-item>Your next opportunity</h1></>);
  expect(screen.getByRole('heading')).toBeVisible();
  expect(observer.factory).not.toHaveBeenCalled();
});

it('reveals asynchronously loaded panels once and disconnects on unmount', async () => {
  const observer=installObservers();
  const view=render(<MotionSystem />);
  const panel=document.createElement('section');
  panel.className='motion-panel'; panel.textContent='Real loaded results';
  act(()=>{ document.body.append(panel); });
  await waitFor(()=>expect(observer.observe).toHaveBeenCalledWith(panel));
  act(()=>observer.reveal(panel));
  expect(panel).toHaveClass('motion-revealed');
  expect(observer.unobserve).toHaveBeenCalledWith(panel);
  view.unmount();
  expect(observer.disconnect).toHaveBeenCalled();
  panel.remove();
});

it('renders readable content in browsers without IntersectionObserver', () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  vi.stubGlobal('matchMedia', vi.fn(() => ({matches:false, addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  render(<><MotionSystem /><p data-motion-item>Available without animation</p></>);
  expect(screen.getByText('Available without animation')).toBeVisible();
});
