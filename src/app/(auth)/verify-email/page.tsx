import { Suspense } from 'react';
import { VerifyEmailContent } from '@/components/auth/email-verification';

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmailContent /></Suspense>;
}
