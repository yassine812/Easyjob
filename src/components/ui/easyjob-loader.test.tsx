import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EasyJobLoader, EasyJobLoading, EasyJobLoadingScreen } from './easyjob-loader';

afterEach(cleanup);

describe('EasyJob loading states', () => {
  it('keeps the loading description accessible without a visible loading caption', () => {
    const { container } = render(<EasyJobLoadingScreen text="Chargement…" />);
    expect(screen.getByRole('status', { name: 'Chargement…' })).toHaveAttribute('aria-busy', 'true');
    expect(container.textContent).toBe('');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses independent SVG gradients when several sections load together', () => {
    const { container } = render(<><EasyJobLoading /><EasyJobLoader width={96} height={30} /></>);
    const gradients = Array.from(container.querySelectorAll('linearGradient'));
    expect(gradients).toHaveLength(2);
    expect(new Set(gradients.map(gradient => gradient.id)).size).toBe(2);
    for (const gradient of gradients) {
      expect(container.querySelector(`[stroke="url(#${gradient.id})"]`)).not.toBeNull();
    }
  });
});
