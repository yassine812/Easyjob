import { StrictMode } from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider, useI18n } from './index';
import { useAuthStore } from '@/store/auth-store';
function Probe() { const { locale, setLocale } = useI18n(); return <><output>{locale}</output><button onClick={() => setLocale('fr')}>French</button></>; }
afterEach(() => { cleanup(); localStorage.removeItem('ss.locale'); });
describe('Language persistence', () => {
  it('preserves saved Arabic during initial Strict Mode hydration and account cleanup', async () => {
    localStorage.setItem('ss.locale', 'ar');
    render(<StrictMode><I18nProvider><Probe /></I18nProvider></StrictMode>);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ar'));
    expect(localStorage.getItem('ss.locale')).toBe('ar');
    useAuthStore.getState().clearSession();
    expect(localStorage.getItem('ss.locale')).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    fireEvent.click(screen.getByRole('button', { name: 'French' }));
    expect(localStorage.getItem('ss.locale')).toBe('fr');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
