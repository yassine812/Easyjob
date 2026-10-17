import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SavedJobs } from './saved-jobs';

vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));
vi.mock('./career-shared', () => ({ CareerFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>, Failure: () => null, panelClass: '' }));
vi.mock('@/components/company/recruitment-workspace', () => ({ PageControls: () => null }));
vi.mock('@/lib/api/candidates', () => ({ candidatesApi: { savedJobs: async () => ['one', 'two'].map(jobId => ({ jobId, createdAt: '2026-09-24', job: { title: `Job ${jobId}`, status: 'PUBLISHED', employmentType: 'FULL_TIME', company: {} } })), removeSavedJob: vi.fn() } }));
vi.mock('@/lib/api/career', () => ({ careerApi: { savedExternalJobs: async () => [], removeExternalSavedJob: vi.fn() } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('renders composite-key saved records without requesting a nonexistent id', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<QueryClientProvider client={new QueryClient()}><SavedJobs /></QueryClientProvider>);
  expect(await screen.findByText('Job one')).toBeInTheDocument();
  expect(screen.getByText('Job two')).toBeInTheDocument();
  expect(errors.mock.calls.flat().join(' ')).not.toMatch(/unique.*key|same key/i);
});
