import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Compass } from 'lucide-react';
import { WorkspaceGuide } from './workspace-guide';

vi.mock('@/lib/i18n/release', () => ({ useReleaseText: () => (_fr: string, en: string) => en }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'en' }) }));
afterEach(cleanup);

it.each([
  ['/candidate/jobs', 'Find jobs'],
  ['/company/demo/applications', 'Applications'],
  ['/platform-admin/users', 'Users'],
])('opens the avatar guide for %s and only exposes available destinations', async (href, label) => {
  render(<WorkspaceGuide items={[
    { href, label, icon: Compass },
    { href: '/hidden', label: 'Restricted', icon: Compass, show: false },
    { href: '/locked', label: 'Locked', icon: Compass, locked: true },
  ]} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'EasyJob guide' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('link', { name: label })).toHaveAttribute('href', href);
  expect(within(dialog).queryByRole('link', { name: 'Restricted' })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('link', { name: 'Locked' })).not.toBeInTheDocument();
  expect(dialog.querySelector('img')?.getAttribute('src')).toContain('easyjob-human-transparent');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
