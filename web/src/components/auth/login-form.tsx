'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowRight, ScanFace } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import { establishSession } from '@/lib/auth-session';
import { getDashboardRoute } from '@/lib/permissions';
import { useAuthStore } from '@/store/auth-store';
import { PageLoader } from '@/components/shared';

import { useI18n } from '@/lib/i18n';
import { useProductText } from '@/lib/i18n/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FaceVerification } from './face-verification';

type FormValues = { email: string; password: string };

function pendingOnboardingRoute(email: string, fallback: string): string {
  if (fallback !== '/candidate/dashboard' || typeof window === 'undefined') return fallback;
  try {
    const saved = JSON.parse(window.localStorage.getItem(`easyjob:onboarding:${email.trim().toLowerCase()}`) ?? 'null') as { pending?: boolean } | null;
    return saved?.pending ? '/register?resume=1' : fallback;
  } catch { return fallback; }
}

export function LoginForm() {
  const { t } = useI18n(), copy = useProductText();
  const schema = z.object({ email: z.string().email(copy('invalidEmail')), password: z.string().min(1, copy('requiredPassword')) });
  const router = useRouter();
  const setLastEmail = useAuthStore((s) => s.setLastEmail);
  const status = useAuthStore((s) => s.status);
  const currentUser = useAuthStore((s) => s.user);
  const [error, setError] = useState<string | null>(null);
  const [faceMode, setFaceMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigationCancelled = useRef(false);
  const [navigationWasCancelled, setNavigationWasCancelled] = useState(false);
  const navigationStarted = useRef(false);
  useEffect(() => {
    navigationCancelled.current = false;
    return () => { navigationCancelled.current = true; };
  }, []);


  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: useAuthStore.getState().lastEmail ?? '', password: '' },
  });

  const isSubmitting = form.formState.isSubmitting;
  useEffect(() => {
    // A restored session should resume its workspace. Recovery navigation wins
    // over a late refresh or identity response, including while login is pending.
    if (status !== 'authenticated' || !currentUser || isSubmitting || faceMode || navigationCancelled.current || navigationStarted.current) return;
    navigationStarted.current = true;
    // Defer one frame so Next's router has finished initializing after a
    // dev-server refresh before dispatching the recovery navigation.
    const frame = window.requestAnimationFrame(() => router.replace(pendingOnboardingRoute(currentUser.email, getDashboardRoute(currentUser))));
    return () => window.cancelAnimationFrame(frame);
  }, [status, currentUser, isSubmitting, faceMode, router]);

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const { accessToken } = await authApi.login(values);
      if (navigationCancelled.current) return;
      const user = await establishSession(accessToken, values.email);
      if (navigationCancelled.current) return;
      setLastEmail(values.email);

      toast.success(`${t.auth.welcomeBack}, ${user.name}`);
      navigationStarted.current = true;
      router.replace(pendingOnboardingRoute(user.email, getDashboardRoute(user)));
    } catch {
      if (!navigationCancelled.current) setError(copy('loginError'));
    }
  };

  if (status === 'authenticated' && !isSubmitting && !faceMode && !navigationWasCancelled) {
    return <PageLoader />;
  }

  if (faceMode) {
    return (
      <div className="space-y-3">
        <FaceVerification onUsePassword={() => setFaceMode(false)} />
        <Button variant="ghost" className="w-full text-xs font-semibold" onClick={() => setFaceMode(false)}>
          {t.face.signInWithPassword}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={event => { void form.handleSubmit(onSubmit)(event); }} className="space-y-3" noValidate>
          {error ? (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
              <p>{error}</p>
              <Link
                href="/forgot-password"
                onClick={() => { navigationCancelled.current = true; setNavigationWasCancelled(true); }}
                className="mt-1.5 inline-block font-semibold underline underline-offset-2"
              >
                {t.auth.forgotPassword}
              </Link>
            </div>
          ) : null}

          {/* Email Address */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-xs font-bold text-gray-700 dark:text-slate-300">
                  {t.auth.email}
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    className="h-10 rounded-xl border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 text-sm focus-visible:ring-[#3F5FDE]"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />

          {/* Password */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-xs font-bold text-gray-700 dark:text-slate-300">
                    {t.auth.password}
                  </FormLabel>
                  <a
                    href="/forgot-password"
                    onClick={() => { navigationCancelled.current = true; setNavigationWasCancelled(true); }}
                    className="text-xs font-semibold text-[#3F5FDE] dark:text-indigo-400 hover:underline"
                  >
                    {t.auth.forgotPassword}
                  </a>
                </div>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                    className="h-10 rounded-xl border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 pe-12 text-sm focus-visible:ring-[#3F5FDE]"
                      {...field}
                    />
                  </FormControl>
                  <button
                    type="button"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    onClick={() => setShowPassword(value => !value)}
                    className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#3F5FDE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3F5FDE] dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                      {showPassword ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 4.3A10.8 10.8 0 0 1 12 4c5.2 0 8.8 4 10 8-0.5 1.7-1.4 3.1-2.6 4.4M6.2 6.2C4.6 7.3 3.4 9 2 12c1.2 4 4.8 8 10 8 1.4 0 2.7-.3 3.8-.9" /></> : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>}
                    </svg>
                  </button>
                </div>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />

          {/* Primary Action Button */}
          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#3F5FDE] hover:bg-[#3252c8] text-white py-2.5 px-4 text-xs font-semibold transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
          >
            {form.formState.isSubmitting ? (
              copy('signingIn')
            ) : (
              <>
                <span>{copy('continue')}</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </form>
      </Form>

      {/* Divider */}
      <div className="relative my-4 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-slate-800" />
        </div>
        <span className="relative bg-white dark:bg-slate-900 px-3 text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase">
          {copy('or')}
        </span>
      </div>

      {/* Social / OAuth Buttons */}
      <div className="space-y-2.5">
<button
          type="button"
          onClick={() => setFaceMode(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 py-3 text-xs font-semibold text-gray-800 dark:text-slate-200 transition-colors shadow-xs cursor-pointer"
        >
          <ScanFace className="size-4 text-[#3F5FDE]" />
          <span>{t.face.signInWithFace}</span>
        </button>
      </div>

      <p className="pt-2 text-center text-xs text-gray-500 dark:text-slate-400">
        {copy('noAccount')}{' '}
        <Link href="/register" className="font-bold text-[#3F5FDE] dark:text-indigo-400 hover:underline">
          {copy('createAccount')}
        </Link>
      </p>
    </div>
  );
}
