import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AssessmentReview } from './assessment-review';
import { assessmentsApi } from '@/lib/api/assessments';

vi.mock('@/lib/i18n/company', () => ({ useCompanyText: () => (key: string) => key }));
vi.mock('@/lib/api/assessments', () => ({ assessmentsApi: { review: vi.fn(), grade: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const fixture = { id: 'attempt', status: 'COMPLETED', score: 0, maxScore: 3, answers: [{ questionId: 'question', answer: 'Evidence supplied by candidate', score: null, question: { prompt: 'Explain idempotency', points: 3, type: 'TEXT' as const } }] };
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><AssessmentReview companyId="company" attemptId="attempt" /></QueryClientProvider>);
}
describe('Assessment human review', () => {
  it('keeps ungraded answers blank, rejects over-scoring and submits an explicit human mark', async () => {
    vi.mocked(assessmentsApi.review).mockResolvedValue(fixture);
    vi.mocked(assessmentsApi.grade).mockResolvedValue({ ...fixture, score: 3 });
    show();
    const input = await screen.findByRole('spinbutton');
    expect(input).toHaveValue(null);
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '4' } });
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => expect(assessmentsApi.grade).toHaveBeenCalledWith('company', 'attempt', [{ questionId: 'question', score: 3 }]));
  });
  it('shows a retry action when the answer request fails', async () => {
    vi.mocked(assessmentsApi.review).mockRejectedValue(new Error('unavailable'));
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('loadError');
    expect(screen.getByRole('button', { name: 'retry' })).toBeEnabled();
  });
});
