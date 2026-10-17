'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Camera, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { FaceEnrollment } from '@/components/auth/face-enrollment';
import { getDashboardRoute, resolveAccountType } from '@/lib/permissions';
import { RequireAuth } from '@/components/shared/guards';
import { useReleaseText } from '@/lib/i18n/release';
import { candidatesApi } from '@/lib/api/candidates';

export default function FacialSetupPage() {
  return <RequireAuth><FacialSetupContent /></RequireAuth>;
}

function FacialSetupContent() {
  const router = useRouter();
  const t = useReleaseText();
  const user = useAuthStore((s) => s.user);
  const [startVerification, setStartVerification] = useState(false);

  const isCandidate = resolveAccountType(user) === 'candidate';
  useEffect(() => {
    if (user && !isCandidate) router.replace(getDashboardRoute(user));
  }, [user, isCandidate, router]);
  if (!user || !isCandidate) return null;

  const handleDone = () => {
    router.replace('/candidate/dashboard');
  };

  const handleSkip = () => {
    router.replace('/candidate/dashboard');
  };

  if (startVerification) {
    return (
      <div className="w-full max-w-xl mx-auto space-y-6">
        <div className="rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl shadow-indigo-950/5 text-center">
          <FaceEnrollment onDone={handleDone} onReferenceFrame={(frame) => candidatesApi.uploadPhoto(frame)} onCancel={handleSkip} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 shadow-2xl shadow-indigo-950/5 text-center space-y-6">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-[#3F5FDE] dark:text-indigo-400">
          <ShieldCheck className="size-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {t('Activer Face ID', 'Enable Face ID', 'تفعيل تسجيل الدخول بالوجه')}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
            {t('Enregistrez votre visage pour une connexion facultative. Votre mot de passe reste disponible.', 'Register your face for optional face login. Your password remains available.', 'سجّل وجهك لتسجيل الدخول الاختياري. تبقى كلمة المرور متاحة.')}
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={() => setStartVerification(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#3F5FDE] hover:bg-[#3252c8] text-white py-3.5 px-4 text-xs font-semibold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Camera className="size-4" />
            <span>{t('Configurer la caméra', 'Set up camera', 'إعداد الكاميرا')}</span>
          </button>

          <button
            onClick={handleSkip}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 py-3 px-4 text-xs font-semibold text-gray-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <span>{t('Plus tard', 'Do it later', 'لاحقاً')}</span>
            <ArrowRight className="size-3.5 text-gray-400" />
          </button>
        </div>

        <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-normal pt-2">
          {t('Vous pouvez activer ou supprimer Face ID dans vos paramètres.', 'You can enable or delete Face ID in your settings.', 'يمكنك تفعيل أو حذف تسجيل الدخول بالوجه من الإعدادات.')}
        </p>
      </div>
    </div>
  );
}
