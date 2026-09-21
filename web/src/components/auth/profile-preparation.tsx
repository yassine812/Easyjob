'use client';
import { useReleaseText } from '@/lib/i18n/release';
import { Button } from '@/components/ui/button';
import { EasyJobCharacter } from './easyjob-coach';
import styles from './easyjob-coach.module.css';

export function ProfilePreparation({ stalled, failed, hasResume, onCheck, onManual }: {
  stalled: boolean; failed: boolean; hasResume: boolean; onCheck: () => void; onManual?: () => void;
}) {
  const tr = useReleaseText();
  const needsHelp = stalled || failed;
  return <div className={`${styles.scene} ${styles.preparation}`}>
    <EasyJobCharacter pose={needsHelp ? 0 : 1} />
    <div className={styles.dialogue}>
      <span className="text-xs font-semibold tracking-widest text-indigo-200">EASYJOB · {tr('TON PROFIL', 'YOUR PROFILE', 'ملفك')}</span>
      <div className={styles.bubble} role="status" aria-live="polite" aria-atomic="true">
        <div className={styles.reply}>
          <h3>{failed ? tr('Un petit contretemps', 'A little setback', 'عائق بسيط') : stalled ? tr('Cela prend un peu plus de temps…', 'This is taking a little longer…', 'يستغرق هذا وقتاً أطول قليلاً…') : tr('Quelques instants, on prépare ton profil !', 'Just a few moments, we’re preparing your profile!', 'لحظات قليلة، نجهّز ملفك!')}</h3>
          <p>{failed ? tr('La préparation n’a pas abouti. Tu peux vérifier à nouveau ou continuer manuellement dès que ton profil est disponible.', 'Preparation could not finish. Check again, or continue manually once your profile is available.', 'لم يكتمل التحضير. تحقق مجدداً أو تابع يدوياً عندما يصبح ملفك متاحاً.') : stalled ? tr('Ton compte est créé. Tu peux continuer à remplir ton profil sans attendre la lecture du CV.', 'Your account is created. You can fill in your profile without waiting for the CV.', 'تم إنشاء حسابك. يمكنك إكمال ملفك دون انتظار قراءة السيرة.') : hasResume ? tr('Je lis ton CV et rassemble tes expériences, tes compétences et tes projets. Cela peut prendre quelques minutes. Tu pourras tout vérifier juste après !', 'I’m reading your CV and gathering your experience, skills and projects. This can take a few minutes. You’ll be able to review everything next!', 'أقرأ سيرتك وأجمع خبراتك ومهاراتك ومشاريعك. قد يستغرق ذلك بضع دقائق. ستراجع كل شيء بعدها!') : tr('Je prépare ton espace pour que tu puisses raconter ton parcours. On y est presque !', 'I’m getting your workspace ready for your career story. Almost there!', 'أجهّز مساحتك لعرض مسارك المهني. أوشكنا على الانتهاء!')}</p>
        </div>
      </div>
      {!needsHelp && <div className={styles.preparingDots} aria-hidden="true"><span /><span /><span /></div>}
      {needsHelp && <div className={styles.actions}>
        <Button type="button" onClick={onCheck}>{tr('Vérifier à nouveau', 'Check again', 'تحقق مجدداً')}</Button>
        {onManual && <Button type="button" variant="outline" className="border-slate-500 bg-transparent text-slate-100 hover:bg-slate-800" onClick={onManual}>{tr('Continuer manuellement', 'Continue manually', 'المتابعة يدوياً')}</Button>}
      </div>}
    </div>
  </div>;
}
