import { beforeEach, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/providers/theme-provider';
import { ThemeToggle } from './theme-toggle';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ss.locale', 'fr');
  document.documentElement.classList.remove('dark');
});

function renderToggles() {
  return render(<ThemeProvider><I18nProvider><ThemeToggle /><ThemeToggle size="sm" /></I18nProvider></ThemeProvider>);
}

it('keeps theme switches synchronized, supports keyboard input and restores the saved choice', async () => {
  const user = userEvent.setup();
  const view = renderToggles();
  const switches = await screen.findAllByRole('switch', { name: 'Mode sombre' });
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  await user.click(switches[0]);
  await waitFor(() => {
    expect(document.documentElement).toHaveClass('dark');
    switches.forEach(toggle => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    expect(localStorage.getItem('theme')).toBe('dark');
  });
  view.unmount();
  renderToggles();
  const restored = await screen.findAllByRole('switch', { name: 'Mode sombre' });
  await waitFor(() => restored.forEach(toggle => expect(toggle).toHaveAttribute('aria-checked', 'true')));
  restored[1].focus();
  await user.keyboard(' ');
  await waitFor(() => {
    expect(document.documentElement).not.toHaveClass('dark');
    restored.forEach(toggle => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    expect(localStorage.getItem('theme')).toBe('light');
  });
});
