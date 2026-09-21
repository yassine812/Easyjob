'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MailCheck, RefreshCw } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth-store';
import { getDashboardRoute, isCompanyUser } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const urlToken = searchParams.get('token');
  const [token, setToken] = useState(urlToken ?? '');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>(urlToken ? 'idle' : 'idle');
  const [message, setMessage] = useState<string | null>(null);
  const lastEmail = useAuthStore((s) => s.lastEmail);

  const verify = useMutation({
    mutationFn: (t: string) => authApi.verifyEmail({ token: t }),
    onSuccess: () => {
      setStatus('success');
      toast.success('Email verified — your account is now active');
      if (useAuthStore.getState().accessToken) {
        useAuthStore.getState().setUser({ ...useAuthStore.getState().user! });
      }
    },
    onError: (err) => {
      setStatus('error');
      setMessage(err instanceof ApiError ? err.message : 'Verification failed');
    },
  });

  useEffect(() => {
    if (urlToken) verify.mutate(urlToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken]);

  if (status === 'success') {
    const user = useAuthStore.getState().user;
    const isCompany = isCompanyUser(user);
    const nextRoute = isCompany ? getDashboardRoute(user) : '/facial-setup';

    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
          <MailCheck className="size-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Email Verified!</h2>
          <p className="mt-1 text-xs text-gray-600 dark:text-slate-300">
            {isCompany
              ? 'Your company account is now active. Proceed to your company dashboard.'
              : 'Your account is now active. Proceed to complete your profile.'}
          </p>
        </div>
        <button
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#3F5FDE] hover:bg-[#3252c8] text-white py-3.5 px-4 text-xs font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          onClick={() => window.location.assign(nextRoute)}
        >
          {isCompany ? 'Go to Company Dashboard' : 'Continue to Setup'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Verify your email</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {urlToken
          ? 'Verifying your email…'
          : 'Enter the verification token from the email we sent you (the part after ?token= in the link).'}
      </p>

      {message ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {message}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        <div>
          <Label htmlFor="vt">Verification token</Label>
          <Input
            id="vt"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste token here"
            className="mt-1 font-mono"
          />
        </div>
        <Button
          className="w-full"
          disabled={!token || verify.isPending}
          onClick={() => verify.mutate(token)}
        >
          {verify.isPending ? 'Verifying…' : 'Verify email'}
        </Button>
      </div>

      <div className="mt-6 rounded-lg border bg-muted/40 p-4">
        <p className="text-sm font-medium">Didn&apos;t receive the email?</p>
        {lastEmail ? (
          <Button
            variant="link"
            className="mt-1 h-auto p-0 text-sm text-muted-foreground"
            onClick={async () => {
              try {
                await authApi.resendVerification(lastEmail);
                toast.success('Verification email sent');
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : 'Could not resend email');
              }
            }}
          >
            <RefreshCw className="mr-1 size-3.5" /> Resend to {lastEmail}
          </Button>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            <a href="/forgot-password" className="hover:underline">
              Request a new verification link
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
