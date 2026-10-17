import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import NotFound from './not-found';

const state = vi.hoisted(() => ({ path: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => state.path }));
vi.mock('@/lib/i18n/support', () => ({ useSupportText: () => (key: string) => key }));
vi.mock('@/lib/i18n/recruitment', () => ({ useRecruitmentText: () => (key: string) => key }));
afterEach(cleanup);

describe('404 workspace navigation', () => {
  it('keeps recruiter errors inside the company workspace', () => {
    state.path = '/company/company-a/jobs/missing/applications';
    render(<NotFound />);
    expect(screen.getByRole('link', { name: 'backToOffers' })).toHaveAttribute('href', '/company/company-a/jobs');
    expect(screen.getByRole('link', { name: 'backDashboard' })).toHaveAttribute('href', '/company/company-a/dashboard');
    expect(screen.queryByRole('link', { name: 'findJobs' })).not.toBeInTheDocument();
  });
  it('retains candidate actions for candidate errors', () => {
    state.path = '/candidate/missing';
    render(<NotFound />);
    expect(screen.getByRole('link', { name: 'findJobs' })).toHaveAttribute('href', '/candidate/jobs');
    expect(screen.getByRole('link', { name: 'backDashboard' })).toHaveAttribute('href', '/candidate/dashboard');
  });
  it('does not send public visitors into a candidate workspace', () => {
    state.path = '/missing';
    render(<NotFound />);
    expect(screen.getByRole('link', { name: 'backHome' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'findJobs' })).toHaveAttribute('href', '/jobs');
  });
});
