import { useState } from 'react';
import { cleanup, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
const render = (ui: React.ReactNode) => rtlRender(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TooltipProvider>{ui}</TooltipProvider></QueryClientProvider>);
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobTitleInput } from './job-title-input';
import { JobCreationAssistant, type JobSuggestionSelection } from './job-creation-assistant';

const mocks = vi.hoisted(() => ({ titles: vi.fn(), autofill: vi.fn(), premium: true }));
vi.mock('@/lib/api/jobs', () => ({ jobsApi: { titleSuggestions: mocks.titles, autofill: mocks.autofill } }));
vi.mock('@/hooks/use-entitlement', () => ({ useEntitlement: () => ({ feature: () => mocks.premium, loading: false }) }));
vi.mock('@/lib/i18n/recruitment', () => ({ useRecruitmentText: () => (key: string) => key }));
vi.mock('@/lib/i18n/company', () => ({ useCompanyText: () => (key: string) => key }));
vi.mock('@/lib/i18n/job-builder', () => ({ useBuilderText: () => (key: string) => key }));
vi.mock('@/lib/i18n/ux', () => ({ useUxText: () => (key: string) => key }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const role = { id: 'devops_engineer', label: 'DevOps Engineer' };
const draft = { title: role.label, descriptions: [{ id: 'professional', text: 'A DevOps proposal.' }, { id: 'concise', text: 'A short proposal.' }, { id: 'technical', text: 'Terraform and CI/CD.' }], responsibilities: ['Maintain CI/CD'], skills: [{ name: 'Linux', required: true, level: 'INTERMEDIATE' }], preferredSkills: ['Terraform'] };

beforeEach(() => { vi.clearAllMocks(); mocks.premium = true; mocks.titles.mockResolvedValue([role, { id: 'platform_engineer', label: 'Platform Engineer' }]); mocks.autofill.mockResolvedValue(draft); });
afterEach(cleanup);

describe('job title autocomplete', () => {
  function Title({ selected = vi.fn() }) { const [value, setValue] = useState(''); return <><JobTitleInput aria-label="Title" value={value} onChange={setValue} onSelect={selected} /><button>Outside</button></>; }
  it('navigates with arrows and Enter, and closes on Escape and blur', async () => {
    const user = userEvent.setup(), selected = vi.fn();
    render(<Title selected={selected} />);
    await user.type(screen.getByRole('combobox'), 'DevOps');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(selected).toHaveBeenCalledWith({ id: 'platform_engineer', label: 'Platform Engineer' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.clear(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), 'DevOps');
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    await user.click(screen.getByRole('combobox'));
    await screen.findByRole('listbox');
    await user.tab();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  }, 15000);
  it('does not show stale results while a new query loads or when it has no matches', async () => {
    const user = userEvent.setup(); render(<Title />);
    await user.type(screen.getByRole('combobox'), 'DevOps'); await screen.findByRole('listbox');
    mocks.titles.mockResolvedValue([]);
    await user.clear(screen.getByRole('combobox')); await user.type(screen.getByRole('combobox'), 'zzzz');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.titles).toHaveBeenLastCalledWith('zzzz'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('contextual suggestion preview', () => {
  function Assistant({ apply = vi.fn(), scope = 'description' }: { apply?: (selection: JobSuggestionSelection) => void; scope?: 'description' | 'all' }) {
    return <JobCreationAssistant companyId="company" title={role.label} role={role} input={{ seniority: 'SENIOR', workMode: 'REMOTE', location: 'Tunis', locale: 'fr' }} scope={scope} existingDescription="Keep this existing text" onApply={apply} />;
  }
  it('never overwrites an existing description on generation, variant change or cancel', async () => {
    const user = userEvent.setup(), apply = vi.fn(); render(<Assistant apply={apply} />);
    await user.click(screen.getByRole('button', { name: /suggestion —/ }));
    await screen.findByText('A DevOps proposal.');
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'applyDraft' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'variant_technical' }));
    expect(apply).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'cancel' }));
    expect(apply).not.toHaveBeenCalled();
    expect(mocks.autofill).toHaveBeenCalledWith(expect.objectContaining({ roleId: role.id, seniority: 'SENIOR', location: 'Tunis' }), 'company');
  });
  it('applies only selected content after explicit confirmation', async () => {
    const user = userEvent.setup(), apply = vi.fn(); render(<Assistant apply={apply} scope="all" />);
    await user.click(screen.getByRole('button', { name: /suggestion —/ })); await screen.findByText('A DevOps proposal.');
    await user.click(screen.getByRole('checkbox', { name: 'Maintain CI/CD' }));
    await user.click(screen.getByRole('button', { name: 'Terraform' }));
    await user.click(screen.getByRole('button', { name: 'applyDraft' }));
    expect(apply).toHaveBeenCalledWith({ description: undefined, responsibilities: ['Maintain CI/CD'], skills: [{ name: 'Terraform', required: false, level: 'INTERMEDIATE' }] });
  });
  it('replaces a description only after the section toggle and Apply', async () => {
    const user = userEvent.setup(), apply = vi.fn(); render(<Assistant apply={apply} />);
    await user.click(screen.getByRole('button', { name: /suggestion —/ })); await screen.findByText('A DevOps proposal.');
    await user.click(screen.getByRole('switch', { name: 'includeDescription' }));
    await user.click(screen.getByRole('button', { name: 'applyDraft' }));
    expect(apply).toHaveBeenCalledWith({ description: 'A DevOps proposal.', responsibilities: [], skills: [] });
  });
  it('selects and clears sections independently and preserves canonical skill names', async () => {
    mocks.autofill.mockResolvedValue({ ...draft, skillLabels: { Linux: 'Système Linux' } });
    const user = userEvent.setup(), apply = vi.fn(); render(<Assistant apply={apply} scope="all" />);
    await user.click(screen.getByRole('button', { name: /suggestion —/ })); await screen.findByText('A DevOps proposal.');
    await user.click(screen.getByRole('button', { name: 'selectAll' }));
    expect(screen.getByRole('checkbox', { name: 'Maintain CI/CD' })).toBeChecked();
    await user.click(screen.getByRole('switch', { name: 'includeResponsibilities' }));
    expect(screen.getByRole('checkbox', { name: 'Maintain CI/CD' })).not.toBeChecked();
    await user.click(screen.getByRole('switch', { name: 'includeSkills' }));
    expect(screen.getByRole('button', { name: 'Système Linux' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Terraform' }));
    await user.click(screen.getByRole('button', { name: 'applyDraft' }));
    expect(apply).toHaveBeenCalledWith({ description: undefined, responsibilities: [], skills: [{ name: 'Linux', required: true, level: 'INTERMEDIATE' }] });
  });
  it('does not call advanced APIs without premium access', async () => {
    mocks.premium = false;
    const user = userEvent.setup(); render(<Assistant />);
    await user.click(screen.getByRole('button', { name: /suggestion —/ }));
    expect(screen.getByText('premiumJobCreationHelp')).toBeInTheDocument();
    expect(mocks.autofill).not.toHaveBeenCalled();
  });
  it('keeps the form intact when the API fails', async () => {
    mocks.autofill.mockRejectedValue(new Error('API unavailable'));
    const user = userEvent.setup(), apply = vi.fn(); render(<Assistant apply={apply} />);
    await user.click(screen.getByRole('button', { name: /suggestion —/ }));
    await screen.findByRole('alert');
    expect(apply).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'applyDraft' })).not.toBeInTheDocument();
  });
});
