import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom lacks matchMedia (used by next-themes / shadcn)
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// ResizeObserver is used by some shadcn components (Select, Dialog)
if (!('ResizeObserver' in window)) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverMock;
}

if (!('scrollIntoView' in Element.prototype)) {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    value: vi.fn(),
    writable: true,
  });
}

// crypto.randomUUID used by the API client
if (!crypto.randomUUID) {
  Object.defineProperty(crypto, 'randomUUID', {
    value: () => `test-${Math.random().toString(36).slice(2)}-${Date.now()}`,
  });
}
