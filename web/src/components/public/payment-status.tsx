'use client';
import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, CheckCircle2, Clock } from 'lucide-react';
import { billingApi } from '@/lib/api/billing';
import { useCareerText } from '@/lib/i18n/career';
import { RequireAuth } from '@/components/shared/guards';
import { Button } from '@/components/ui/button';
import { Busy, Failure, panelClass } from '@/components/candidate/career-shared';

export function CheckoutUnavailable() {
  const t = useCareerText();
  return <div className="mx-auto max-w-xl px-5 py-20"><section className={`${panelClass} space-y-5 text-center`}><CreditCard className="mx-auto size-10 text-indigo-500" /><h1 className="text-2xl font-semibold">{t('paymentsUnavailable')}</h1><p className="text-sm text-muted-foreground">{t('paymentsUnavailableHelp')}</p><Button asChild variant="outline"><Link href="/pricing">{t('subscription')}</Link></Button></section></div>;
}
export function PaymentResult() { return <RequireAuth><Suspense fallback={<Busy />}><PaymentResultContent /></Suspense></RequireAuth>; }
function PaymentResultContent() {
  const t = useCareerText(), params = useSearchParams(), qc = useQueryClient();
  const ref = params.get('ref');
  const payment = useQuery({ queryKey: ['payment-status', ref], queryFn: () => billingApi.paymentStatus(ref!), enabled: !!ref,
    refetchInterval: q => q.state.error || ['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'].includes(q.state.data?.status || '') ? false : 3000 });
  const paid = payment.data?.status === 'SUCCEEDED';
  useEffect(() => { if (paid) { void qc.invalidateQueries({ queryKey: ['subscription-me'] }); void qc.invalidateQueries({ queryKey: ['company-access'] }); } }, [paid, qc]);
  if (!ref) return <CheckoutUnavailable />;
  return <div className="mx-auto max-w-xl px-5 py-20">{payment.isError ? <Failure retry={() => payment.refetch()} /> : payment.isPending ? <Busy /> : <section className={`${panelClass} space-y-5 text-center`}>{paid ? <CheckCircle2 className="mx-auto size-12 text-emerald-600" /> : <Clock className="mx-auto size-12 text-indigo-500" />}<h1 className="text-2xl font-semibold">{t(paid ? 'paymentConfirmed' : 'paymentStatus')}</h1><p>{t(payment.data.status)}</p><p className="text-sm text-muted-foreground">{paid ? payment.data.planName : t('paymentPendingHelp')}</p><Button asChild><Link href="/dashboard">{t('dashboard')}</Link></Button></section>}</div>;
}
