'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useReleaseText } from '@/lib/i18n/release';
import { Button } from '@/components/ui/button';
import { EasyJobCharacter } from '@/components/auth/easyjob-coach';
import { GuideSpotlight } from './guide-spotlight';
import styles from './guide-spotlight.module.css';

const steps = [
  { href: '/candidate/dashboard', title: ['Bienvenue sur EasyJob', 'Welcome to EasyJob', 'مرحباً بك في EasyJob'], body: ['Voici ton tableau de bord : retrouve ton profil, tes candidatures et tes prochaines actions. Ce petit guide te fait découvrir les outils à ton rythme.', 'Your dashboard brings together your profile, applications and next actions. This short guide shows you where to find your tools.', 'تجمع لوحة التحكم ملفك وترشحاتك وخطواتك القادمة. يعرّفك هذا الدليل السريع بأدواتك.'] },
  { href: '/candidate/cvs', title: ['Ton CV et son analyse', 'Your CV and its analysis', 'سيرتك الذاتية وتحليلها'], body: ['Retrouve le CV importé et consulte son analyse ATS. Les onglets te permettent aussi de créer une version améliorée de ton CV.', 'Find your uploaded CV and review its ATS analysis. Use the tabs to create an improved version of your CV.', 'اعثر على سيرتك المرفوعة وراجع تحليلها. استخدم علامات التبويب لإنشاء نسخة محسّنة منها.'] },
  { href: '/candidate/jobs', title: ['Trouve les bonnes offres', 'Find suitable jobs', 'اعثر على الوظائف المناسبة'], body: ['Explore les offres, utilise les filtres et sauvegarde celles qui t’intéressent. Retrouve aussi tes recommandations et tes alertes dans les onglets.', 'Explore jobs, filter the results and save the ones you like. The tabs also lead to your recommendations and alerts.', 'تصفّح الوظائف وصفِّ النتائج واحفظ ما يهمك. تتيح لك علامات التبويب الوصول إلى التوصيات والتنبيهات.'] },
  { href: '/candidate/applications', title: ['Suis tes candidatures', 'Track your applications', 'تابع ترشحاتك'], body: ['Consulte le statut de chaque candidature et retrouve les réponses des recruteurs. Tout ton suivi est regroupé ici.', 'Check each application’s status and find recruiter responses. Keep track of your progress here.', 'راجع حالة كل ترشح وردود مسؤولي التوظيف وتابع تقدّمك هنا.'] },
  { href: '/candidate/interview-coach', title: ['Prépare tes entretiens', 'Prepare for interviews', 'استعد للمقابلات'], body: ['Entraîne-toi avec le coach sur un poste qui t’intéresse. Il te propose des questions et des conseils pour améliorer tes réponses.', 'Practise with the coach for a role you are interested in. Get questions and feedback to improve your answers.', 'تدرّب مع المدرب على الوظيفة التي تهمك واحصل على أسئلة وملاحظات لتحسين إجاباتك.'] },
  { href: '/candidate/profile', title: ['Fais évoluer ton profil', 'Keep your profile up to date', 'حدّث ملفك الشخصي'], body: ['Modifie ta photo, tes expériences, ta formation et tes compétences quand tu veux. Tu es prêt : revenons au tableau de bord !', 'Update your photo, experience, education and skills whenever you want. You are ready—let’s return to your dashboard!', 'حدّث صورتك وخبراتك وتعليمك ومهاراتك متى شئت. أنت جاهز، لنعد إلى لوحة التحكم!'] },
] as const;

export function CandidateGuide() {
  const t = useReleaseText(), router = useRouter(), pathname = usePathname();
  const userId = useAuthStore(state => state.user?.id);
  const [current, setCurrent] = useState<number | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const key = userId ? `easyjob:app-guide:v1:${userId}` : null;

  useEffect(() => {
    if (!key || loadedFor === key) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(key); } catch { /* The guide also works without browser storage. */ }
    if (saved === 'done') { setCurrent(null); setLoadedFor(key); return; }
    if (saved === null && pathname !== '/candidate/dashboard') return;
    const index = saved === null ? 0 : Number(saved);
    setCurrent(Number.isInteger(index) && index >= 0 && index < steps.length ? index : 0);
    setLoadedFor(key);
  }, [key, loadedFor, pathname]);

  useEffect(() => {
    if (current === null || !key || loadedFor !== key) return;
    try { localStorage.setItem(key, String(current)); } catch { /* Keep the current session usable. */ }
  }, [current, key, loadedFor, pathname]);

  // Follow real navigation as well as the guide controls.
  useEffect(() => {
    const index = steps.findIndex(step => pathname === step.href || pathname.startsWith(`${step.href}/`));
    if (index >= 0) setCurrent(previous => previous === null ? null : index);
  }, [pathname]);

  if (!key || loadedFor !== key) return null;
  if (current === null) return <Button variant="outline" className="fixed bottom-24 end-4 z-40 gap-2 rounded-full bg-card shadow-lg lg:bottom-6" onClick={() => { setCurrent(0); router.push('/candidate/dashboard'); }}><MessageCircle aria-hidden="true" className="size-4" />{t('Revoir le guide', 'Replay guide', 'إعادة الدليل')}</Button>;
  const step = steps[current];
  const reply = step.body;
  const finish = () => {
    if (key) { try { localStorage.setItem(key, 'done'); } catch { /* Dismiss for this session. */ } }
    setCurrent(null);
    router.replace('/candidate/dashboard');
  };
  const move = (index: number) => {
    if (key) { try { localStorage.setItem(key, String(index)); } catch { /* Continue without storage. */ } }
    setCurrent(index);
    router.push(steps[index].href);
  };

  return <GuideSpotlight step={current} href={step.href} label={t('Guide EasyJob', 'EasyJob guide', 'دليل EasyJob')}>
    <div className={styles.character}><EasyJobCharacter floating pose={current === 0 ? 0 : current === steps.length - 1 ? 2 : 1} /></div>
    <div className={styles.bubble}>
    <div className={styles.bubbleContent}>
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{current + 1} / {steps.length}</span>
      <button type="button" className="rounded px-2 py-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary" onClick={finish}>{t('Passer le guide', 'Skip guide', 'تخطّ الدليل')}</button>
    </div>
    <div aria-live="polite" aria-atomic="true">
      <h2 className="text-base font-semibold">{t(step.title[0], step.title[1], step.title[2])}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(reply[0], reply[1], reply[2])}</p>
    </div>
    <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
      <Button size="sm" variant="ghost" disabled={current === 0} onClick={() => move(current - 1)}>{t('Précédent', 'Previous', 'السابق')}</Button>
      <Button size="sm" onClick={() => current === steps.length - 1 ? finish() : move(current + 1)}>{current === steps.length - 1 ? t('Terminer', 'Finish', 'إنهاء') : t('Suivant', 'Next', 'التالي')}<ArrowRight aria-hidden="true" className="ms-2 size-4 rtl:rotate-180" /></Button>
    </div>
    </div>
    </div>
  </GuideSpotlight>;
}
