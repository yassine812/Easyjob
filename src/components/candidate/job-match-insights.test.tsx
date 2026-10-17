import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { JobMatchInsights } from './job-match-insights';

vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));
afterEach(cleanup);

it('renders the real score, deduplicated skills and unknown criteria without fabricating percentages', () => {
  render(<JobMatchInsights match={{ score: 87, classification: 'STRONG', matchedSkills: ['Python', 'python'], missingSkills: ['SQL'], dimensions: [{ key: 'skills', score: 80, evidence: ['Python'] }, { key: 'education', score: null, evidence: [] }] }} />);
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '87');
  expect(screen.getByRole('progressbar', { name: 'Compétences' })).toHaveAttribute('aria-valuenow', '80');
  expect(screen.getByRole('progressbar', { name: 'Formation' })).not.toHaveAttribute('aria-valuenow');
  expect(screen.getByText('Non évalué')).toBeInTheDocument();
  expect(screen.getAllByText('python', { exact: false }).filter(node => node.tagName === 'SPAN')).toHaveLength(1);
});

it('does not display a fake zero when no match can be assessed', () => {
  render(<JobMatchInsights match={{ score: null, classification: 'NOT_ANALYZED' }} />);
  expect(screen.getByRole('meter')).not.toHaveAttribute('aria-valuenow');
  expect(screen.queryByText('0%')).not.toBeInTheDocument();
});
