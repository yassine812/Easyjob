'use client';
import { useI18n } from '@/lib/i18n';
import { useProductText } from '@/lib/i18n/product';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  const { t } = useI18n(), copy = useProductText();
  return (
    <div>
      <div className="text-center mb-4">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t.auth.welcomeBack}
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-gray-500 dark:text-slate-400">
          {copy('signInHelp')}
        </p>
      </div>

      <LoginForm />
    </div>
  );
}
