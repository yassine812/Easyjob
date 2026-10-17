import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EasyJobCoach } from './easyjob-coach';
import { LanguageLevelSelect } from '../candidate/language-level-select';
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));
vi.mock('@/lib/i18n/release', () => ({ useReleaseText: () => (fr: string) => fr }));
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('EasyJob dialogue', () => {
  it('explains the offer before showing a visible confirmation and opening plans once', () => {
    vi.useFakeTimers(); const upgrade = vi.fn(), later = vi.fn();
    render(<EasyJobCoach onUpgrade={upgrade} onLater={later} finalStep />);
    expect(screen.getByText('Bienvenue chez EasyJob !')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Parle-moi du CV' }));
    expect(screen.getByText('Un coup de pouce pour ton CV ?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Et les autres avantages ?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Oui, voir les tarifs' }));
    expect(screen.getByText('Excellent choix !')).toBeInTheDocument();
    expect(upgrade).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2600));
    expect(upgrade).toHaveBeenCalledTimes(1); expect(later).not.toHaveBeenCalled();
  });
  it('allows later immediately and explains registration will continue', () => {
    vi.useFakeTimers(); const later = vi.fn();
    render(<EasyJobCoach onUpgrade={vi.fn()} onLater={later} finalStep={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Peut-être plus tard' }));
    expect(screen.getByText(/On continue ton inscription/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2600)); expect(later).toHaveBeenCalledTimes(1);
  });
  it('cancels pending navigation when dismissed', () => {
    vi.useFakeTimers(); const later = vi.fn();
    const view = render(<EasyJobCoach onUpgrade={vi.fn()} onLater={later} finalStep />);
    fireEvent.click(screen.getByRole('button', { name: 'Peut-être plus tard' }));
    view.unmount(); act(() => vi.advanceTimersByTime(3000)); expect(later).not.toHaveBeenCalled();
  });
});
describe('Language level dropdown', () => {
  it('keeps native language selected and saves a CEFR selection', () => {
    const change = vi.fn(); render(<LanguageLevelSelect value="Langue maternelle" onChange={change} />);
    expect(screen.getByRole('combobox')).toHaveValue('native');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'B2' } }); expect(change).toHaveBeenCalledWith('B2');
  });
  it('preserves unrecognized imported levels rather than silently replacing them', () => {
    render(<LanguageLevelSelect value="Professionnel" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveValue('Professionnel');
    expect(screen.getAllByRole('option').length).toBe(9);
  });
});
