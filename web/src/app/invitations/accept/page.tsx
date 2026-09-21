'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { invitationsApi } from '@/lib/api/invitations';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth-store';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MEMBER_ROLE_LABELS } from '@/lib/constants';

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = searchParams.get('token') ?? '';
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');
  const setUser = useAuthStore((s) => s.setUser);
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ companyName: string; role: string } | null>(null);

  const accept = useMutation({
    mutationFn: () => invitationsApi.accept(token),
    onSuccess: (res) => {
      setResult({ companyName: res.companyName, role: res.role });
      setState('done');
      toast.success(`You joined ${res.companyName} as ${MEMBER_ROLE_LABELS[res.role] ?? res.role}`);
      // Refresh /auth/me so memberships include the new company.
      authApi
        .me()
        .then((me) => setUser(me))
        .catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ['my-companies'] });
    },
    onError: (err) => {
      setState('error');
      setMessage(err instanceof ApiError ? err.message : 'Could not accept invitation');
    },
  });

  useEffect(() => {
    if (token && isAuthed && state === 'idle') {
      accept.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAuthed]);

  return (
    <div className="flex min-h-screen items-start justify-center bg-muted/30 px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5" /> Team invitation
          </CardTitle>
          <CardDescription>You&apos;ve been invited to join a company on EasyJob.</CardDescription>
        </CardHeader>
        <CardContent>
          {!isAuthed ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Log in with the email address the invitation was sent to, then come back to this
                link to accept it.
              </p>
              <div className="flex justify-center gap-2">
                <Button asChild>
                  <Link href={`/login?next=${encodeURIComponent(`/invitations/accept?token=${token}`)}`}>
                    Log in
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/register?next=${encodeURIComponent(`/invitations/accept?token=${token}`)}`}>
                    Create account
                  </Link>
                </Button>
              </div>
            </div>
          ) : state === 'idle' && accept.isPending ? (
            <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" /> Accepting invitation…
            </div>
          ) : state === 'done' && result ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="size-10 text-emerald-600" />
              <p className="font-medium">
                You joined {result.companyName} as {MEMBER_ROLE_LABELS[result.role] ?? result.role}
              </p>
              <Button
                onClick={() => {
                  const me = useAuthStore.getState().user;
                  const membership = me?.memberships.find((m) => m.companyName === result.companyName);
                  router.push(membership ? `/company/${membership.companyId}/dashboard` : '/dashboard');
                }}
              >
                Go to company workspace
              </Button>
            </div>
          ) : state === 'error' ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-destructive">
                {message ?? 'Could not accept invitation'}
              </p>
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Go to dashboard
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Invitation link detected. Click below to accept.
              </p>
              <Button className="w-full" onClick={() => accept.mutate()} disabled={!token}>
                Accept invitation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense>
      <AcceptInvitationContent />
    </Suspense>
  );
}
