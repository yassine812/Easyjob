import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AuthLayout from '@/app/(auth)/layout';

const route = vi.hoisted(() => ({ value: '/login' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.value }));
vi.mock('@/lib/i18n/product', () => ({ useProductText: () => (key: string) => key }));
vi.mock('@/lib/i18n', () => ({ LanguageToggle: () => <span>Languages</span> }));
vi.mock('@/components/ui/theme-toggle', () => ({ ThemeToggle: () => <span>Theme</span> }));
vi.mock('@/components/layout/logo', () => ({ Logo: () => <span>EasyJob</span> }));
vi.mock('@/components/ui/human-coach', () => ({ HumanCoach: () => <span>Human coach</span> }));

afterEach(() => { cleanup(); delete document.body.dataset.authOnboarding; route.value = '/login'; });

it('keeps entered form data when onboarding switches to the wide layout', () => {
  render(<AuthLayout><form aria-label="Registration"><input aria-label="Email" /></form></AuthLayout>);
  const input = screen.getByRole('textbox', { name: 'Email' });
  fireEvent.change(input, { target: { value: 'candidate@example.test' } });
  expect(screen.getByRole('complementary')).toBeInTheDocument();
  act(() => {
    document.body.dataset.authOnboarding = 'true';
    window.dispatchEvent(new Event('easyjob:onboarding-toggle'));
  });
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Email' })).toBe(input);
  expect(input).toHaveValue('candidate@example.test');
});

it('leaves room for the role selection workflow without the branding column', () => {
  route.value = '/role-select';
  render(<AuthLayout><button>Choose candidate</button><button>Choose company</button></AuthLayout>);
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Choose candidate' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Choose company' })).toBeVisible();
  for (const link of screen.getAllByRole('link', { name: 'backHome' })) expect(link).toHaveAttribute('href', '/');
});
