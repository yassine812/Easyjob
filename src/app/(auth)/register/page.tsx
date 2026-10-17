'use client';

import { Suspense } from 'react';
import { RegisterForm } from '@/components/auth/register-form';
import { useReleaseText } from '@/lib/i18n/release';

function RegisterContent() {
  const tr = useReleaseText();
  return (
    <div>
      <div className="text-center mb-2">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
          {tr('Créer un compte', 'Create an Account', 'إنشاء حساب')}
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-gray-500 dark:text-slate-400">
          {tr('Commence avec EasyJob en quelques secondes.', 'Get started with EasyJob in seconds.', 'ابدأ مع EasyJob في ثوانٍ.')}
        </p>
      </div>

      <RegisterForm />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  );
}
