import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProfilePhoto } from './profile-photo';
import { useAuthStore } from '@/store/auth-store';
const mocks = vi.hoisted(() => ({ post: vi.fn(), remove: vi.fn(), me: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ api: { post: mocks.post, delete: mocks.remove } }));
vi.mock('@/lib/api/auth', () => ({ authApi: { me: mocks.me } }));
vi.mock('@/lib/i18n/release', () => ({ useReleaseText: () => (_fr: string, en: string) => en }));
beforeEach(() => { useAuthStore.getState().setSession('test', { id: 'photo-user', avatarUrl: 'https://images.test/photo.jpg' } as never); });
afterEach(() => { cleanup(); vi.clearAllMocks(); useAuthStore.getState().clearSession(); });
function show(onValidityChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><ProfilePhoto onValidityChange={onValidityChange} /></QueryClientProvider>);
}
it('only marks a saved photo ready after loading, including after remount', async () => {
  const validity = vi.fn(), view = show(validity);
  expect(validity).toHaveBeenLastCalledWith(false);
  fireEvent.load(screen.getByRole('img', { name: 'Your profile photo' }));
  await waitFor(() => expect(validity).toHaveBeenLastCalledWith(true));
  view.unmount(); show(validity);
  expect(validity).toHaveBeenLastCalledWith(false);
});
it('never reports a missing photo as ready', () => {
  useAuthStore.getState().setSession('test', { id: 'photo-user', avatarUrl: null } as never);
  const validity = vi.fn(); show(validity);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(validity).toHaveBeenLastCalledWith(false);
});
it('reports an unreadable saved photo without retrying forever', async () => {
  const validity = vi.fn(); show(validity);
  fireEvent.error(screen.getByRole('img'));
  expect(await screen.findByRole('alert')).toHaveTextContent('The saved photo could not be loaded');
  expect(validity).not.toHaveBeenCalledWith(true);
});
