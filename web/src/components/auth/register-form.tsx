'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowRight, MailCheck } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import { establishSession } from '@/lib/auth-session';
import { useAuthStore } from '@/store/auth-store';
import { ApiError } from '@/lib/api/client';
import { env } from '@/config/env';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CandidateCvOnboarding } from './candidate-cv-onboarding';
import { resumesApi } from '@/lib/api/resumes';
import { useReleaseText } from '@/lib/i18n/release';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(120, 'Name is too long'),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be 72 characters or fewer')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a digit'),
  phone: z.string().max(30, 'Phone is too long').optional().or(z.literal('')),
  website: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function RegisterForm() {
  const tr = useReleaseText();
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('intent') !== 'company') return;
    const frame = window.requestAnimationFrame(() => router.replace('/company/register'));
    return () => window.cancelAnimationFrame(frame);
  }, [router, searchParams]);
  const [selectedRole] = useState<'candidate' | 'company'>('candidate');
  const authStatus = useAuthStore((s) => s.status);
  const currentUser = useAuthStore((s) => s.user);
  const setLastEmail = useAuthStore((s) => s.setLastEmail);
  const [candidateStep2, setCandidateStep2] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [resumeForSession, setResumeForSession] = useState<string | undefined>(undefined);
  const resumeRequested = searchParams.get('resume') === '1';

  useEffect(() => {
    if (!resumeRequested || authStatus !== 'authenticated' || !currentUser) return;
    let active = true;
    void resumesApi.list().then(resumes => {
      if (!active) return;
      setResumeForSession(resumes.find(resume => resume.isPrimary)?.id ?? resumes[0]?.id);
      setCandidateStep2(true);
    }).catch(() => { if (active) setCandidateStep2(true); });
    return () => { active = false; };
  }, [authStatus, currentUser, resumeRequested]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', phone: '', website: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setIsOffline(false);
    setIsDuplicate(false);
    try {
      await authApi.register({
        name: values.name,
        email: values.email,
        password: values.password,
        phone: values.phone || undefined,
        intent: selectedRole,
      });

      // A newly created account should not inherit an old browser draft that
      // happened to use the same email address.
      window.localStorage.removeItem(`easyjob:onboarding:${values.email.trim().toLowerCase()}`);

      setLastEmail(values.email);

      if (selectedRole === 'candidate') {
        const login = await authApi.login({ email: values.email, password: values.password });
        await establishSession(login.accessToken, values.email);
        setCandidateStep2(true);
      } else {
        // Company flow — direct to email verification / company dashboard
        setRegisteredEmail(values.email);
        toast.success('Company account created — check your email to verify it');
      }
    } catch (err) {
      let message = 'Registration failed';
      let isConnError = false;
      let isDupError = false;

      if (err instanceof ApiError) {
        if (err.status === 0 || err.message.includes('connect') || err.message.includes('fetch')) {
          isConnError = true;
          message = `Backend API server (${env.apiUrl}) is currently offline or unreachable.`;
        } else {
          const bodyMsg = (err.body as { message?: string | string[] } | null)?.message;
          let rawMsg = '';
          if (Array.isArray(bodyMsg)) {
            rawMsg = bodyMsg.join(', ');
          } else if (typeof bodyMsg === 'string' && bodyMsg.trim().length > 0) {
            rawMsg = bodyMsg;
          } else if (err.message) {
            rawMsg = err.message;
          }

          if (
            err.status === 409 ||
            rawMsg.toLowerCase().includes('unique value') ||
            rawMsg.toLowerCase().includes('already exists')
          ) {
            isDupError = true;
            message = 'An account with this email address already exists. Please log in or use a different email.';
          } else {
            message = rawMsg || 'Registration failed';
          }
        }
      } else if (err instanceof Error) {
        if (err.message.includes('fetch') || err.message.includes('connect')) {
          isConnError = true;
          message = `Backend API server (${env.apiUrl}) is currently offline or unreachable.`;
        } else if (
          err.message.toLowerCase().includes('unique value') ||
          err.message.toLowerCase().includes('already exists')
        ) {
          isDupError = true;
          message = 'An account with this email address already exists. Please log in or use a different email.';
        } else {
          message = err.message;
        }
      }

      setIsOffline(isConnError);
      setIsDuplicate(isDupError);
      setError(message);
    }
  };

  // Candidate Step 2+: CV Upload & AI Auto-Prefill Flow
  if (selectedRole === 'candidate' && candidateStep2) {
    return (
      <CandidateCvOnboarding
        candidateEmail={currentUser?.email ?? form.getValues('email')}
        candidatePhone={currentUser?.phone ?? form.getValues('phone')}
        initialResumeId={resumeForSession}
        onFinishFace={() => router.push('/facial-setup')}
        onFinishDashboard={() => router.replace('/candidate/dashboard')}
      />
    );
  }

  // Company Email Verification Banner
  if (registeredEmail && selectedRole === 'company') {
    return (
      <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 rounded-2xl p-5">
        <MailCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
        <AlertTitle className="font-bold text-sm">Company Account Created!</AlertTitle>
        <AlertDescription className="text-xs mt-1 leading-relaxed">
          We sent a verification link to <strong>{registeredEmail}</strong>. Click the link in the
          email to activate your company workspace. You can also paste the token{' '}
          <Link href="/verify-email" className="font-bold underline text-emerald-700 dark:text-emerald-300">
            here
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-1.5">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1.5" noValidate>
          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive space-y-2">
              <p className="font-medium">{error}</p>
              {isOffline && (
                <button
                  type="button"
                  onClick={() => form.handleSubmit(onSubmit)()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  <span>Retry connection</span>
                  <ArrowRight className="size-3.5" />
                </button>
              )}
              {isDuplicate && (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#3F5FDE] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#3252c8] transition-colors"
                >
                  <span>Log in to your account</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              )}
            </div>
          ) : null}

          {/* Full Name / Company Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="space-y-0.5">
                <FormLabel className="text-xs font-bold text-gray-700 dark:text-slate-300">
                  {selectedRole === 'company' ? tr('Nom de l’entreprise', 'Company Name', 'اسم الشركة') : tr('Nom complet', 'Full Name', 'الاسم الكامل')}
                </FormLabel>
                <FormControl>
                  <Input
                    autoComplete="name"
                    placeholder={selectedRole === 'company' ? tr('Nom de l’entreprise', 'Company name', 'اسم الشركة') : tr('Prénom et nom', 'First and last name', 'الاسم واللقب')}
                    className="h-9 rounded-xl border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 text-sm focus-visible:ring-[#3F5FDE]"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />

          {/* Email Address */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="space-y-0.5">
                <FormLabel className="text-xs font-bold text-gray-700 dark:text-slate-300">
                  {tr('Adresse e-mail', 'Email Address', 'البريد الإلكتروني')}
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    className="h-9 rounded-xl border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 text-sm focus-visible:ring-[#3F5FDE]"
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
              <FormItem className="space-y-0.5">
                <FormLabel className="text-xs font-bold text-gray-700 dark:text-slate-300">
                  {tr('Mot de passe', 'Password', 'كلمة المرور')}
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="h-9 rounded-xl border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 text-sm focus-visible:ring-[#3F5FDE]"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />

          {/* Phone */}
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem className="space-y-0.5">
                <FormLabel className="text-xs font-bold text-gray-700 dark:text-slate-300">
                  {tr('Téléphone (facultatif)', 'Phone (optional)', 'الهاتف (اختياري)')}
                </FormLabel>
                <FormControl>
                  <Input
                    autoComplete="tel"
                    placeholder="+216 20 000 000"
                    className="h-9 rounded-xl border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 text-sm focus-visible:ring-[#3F5FDE]"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />

          {/* Company Website (optional, only for Company mode) */}
          {selectedRole === 'company' && (
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs font-bold text-gray-700 dark:text-slate-300">
                    Website (optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="url"
                      placeholder="https://company.com"
                      className="h-10 rounded-xl border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 text-sm focus-visible:ring-[#3F5FDE]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#3F5FDE] hover:bg-[#3252c8] text-white py-2.5 px-4 text-xs font-semibold transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50 mt-1"
          >
            {form.formState.isSubmitting ? (
                tr('Création du compte…', 'Creating account...', 'جارٍ إنشاء الحساب…')
            ) : (
              <>
                <span>
                  {selectedRole === 'company' ? tr('Créer le compte entreprise', 'Create Company Account', 'إنشاء حساب شركة') : tr('Créer mon compte candidat', 'Create Candidate Account', 'إنشاء حساب مترشح')}
                </span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </form>
      </Form>

      <p className="pt-2 text-center text-xs text-gray-500 dark:text-slate-400">
        {tr('Tu as déjà un compte ?', 'Already have an account?', 'لديك حساب؟')}{' '}
        <Link href="/login" className="font-bold text-[#3F5FDE] dark:text-indigo-400 hover:underline">
          {tr('Se connecter', 'Log in', 'تسجيل الدخول')}
        </Link>
      </p>
    </div>
  );
}

