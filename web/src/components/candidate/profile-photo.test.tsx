import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProfilePhoto } from './profile-photo';

const mocks = vi.hoisted(() => ({ get: vi.fn(), status: vi.fn(), enroll: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ api: { get: mocks.get }, ApiError: class extends Error {} }));
vi.mock('@/lib/api/biometric', () => ({ biometricApi: { status: mocks.status, enrollFromPhoto: mocks.enroll } }));
vi.mock('@/config/env', () => ({ env: { apiUrl: 'http://localhost:3002/api/v1' } }));
vi.mock('@/lib/i18n/release', () => ({ useReleaseText: () => (_fr: string, en: string) => en }));

beforeEach(() => {
  mocks.get.mockResolvedValue({ url: '/api/v1/files/signed?key=photo&expires=123&sig=test' });
  mocks.status.mockResolvedValue({ enrolled: true });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function show(onValidityChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><ProfilePhoto onValidityChange={onValidityChange} /></QueryClientProvider>);
}

it('loads saved photos using CORS and restores readiness after returning to the step', async () => {
  const validity = vi.fn();
  const first = show(validity);
  const img = await screen.findByRole('img', { name: 'Your profile photo' });
  expect(img).toHaveAttribute('crossorigin', 'anonymous');
  expect(img).toHaveAttribute('src', expect.stringContaining('http://localhost:3002/api/v1/files/signed?'));
  expect(validity).toHaveBeenLastCalledWith(false);
  fireEvent.load(img);
  await waitFor(() => expect(validity).toHaveBeenLastCalledWith(true));
  expect(mocks.enroll).not.toHaveBeenCalled();
  first.unmount();
  show(validity);
  const restored = await screen.findByRole('img', { name: 'Your profile photo' });
  expect(validity).toHaveBeenLastCalledWith(false);
  fireEvent.load(restored);
  await waitFor(() => expect(validity).toHaveBeenLastCalledWith(true));
  expect(mocks.enroll).not.toHaveBeenCalled();
});

it('never reports a missing photo as ready even if biometric enrollment exists', async () => {
  mocks.get.mockResolvedValue({ url: null });
  const validity = vi.fn();
  show(validity);
  await waitFor(() => expect(mocks.get).toHaveBeenCalled());
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(validity).not.toHaveBeenCalledWith(true);
});

it('stops retrying after two failures even when each refetch returns a new signed URL', async () => {
  let version = 0;
  mocks.get.mockImplementation(async () => ({ url: `/api/v1/files/signed?version=${++version}` }));
  const validity = vi.fn();
  show(validity);
  fireEvent.error(await screen.findByRole('img'));
  await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('version=2')));
  fireEvent.error(screen.getByRole('img'));
  await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('version=3')));
  fireEvent.error(screen.getByRole('img'));
  expect(await screen.findByRole('alert')).toHaveTextContent('The saved photo could not be loaded');
  expect(mocks.get).toHaveBeenCalledTimes(3);
  expect(validity).not.toHaveBeenCalledWith(true);
});
