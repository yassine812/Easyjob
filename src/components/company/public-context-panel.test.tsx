import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicContextPanel } from './public-context-panel';

vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));

afterEach(cleanup);

describe('PublicContextPanel', () => {
  it('renders loading, sources and manual skill application without auto-applying', () => {
    const onApplySkill = vi.fn();
    const onRefresh = vi.fn();
    const { rerender } = render(<PublicContextPanel result={{ status: 'QUEUED' }} />);
    expect(screen.getByText('Recherche publique en cours…')).toBeInTheDocument();
    rerender(<PublicContextPanel result={{ status: 'COMPLETED', technologies: ['Kubernetes'], products: [], public_repositories: [], sources: [{ source_url: 'https://example.com/docs', type: 'web', title: 'Documentation', fetched_at: '2026-10-12T00:00:00.000Z' }] }} onApplySkill={onApplySkill} onRefresh={onRefresh} />);
    expect(screen.getByText('Kubernetes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Documentation/ })).toHaveAttribute('href', 'https://example.com/docs');
    expect(screen.getByRole('button', { name: 'Ajouter aux compétences' })).toBeInTheDocument();
    expect(onApplySkill).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter aux compétences' }));
    expect(onApplySkill).toHaveBeenCalledWith('Kubernetes');
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser le contexte public' }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('hides disabled research unless explicitly requested', () => {
    const { container } = render(<PublicContextPanel result={{ status: 'DISABLED' }} />);
    expect(container).toBeEmptyDOMElement();
    render(<PublicContextPanel result={{ status: 'DISABLED' }} showDisabled />);
    expect(screen.getByText('La recherche publique n’est pas activée.')).toBeInTheDocument();
  });
});
