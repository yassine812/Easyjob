'use client';
import { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useReleaseText } from '@/lib/i18n/release';
import { Button } from '@/components/ui/button';
import styles from './easyjob-coach.module.css';

export function EasyJobCharacter({ pose = 0, compact = false, floating = false }: { pose?: number; compact?: boolean; floating?: boolean }) {
  const tr = useReleaseText();
  return <div className={`${styles.stage} ${compact ? styles.compact : ''} ${floating ? styles.floating : ''}`}><div className={styles.portrait} role="img" aria-label={tr('Ton coach EasyJob', 'Your EasyJob coach', 'مدربك EasyJob')}>
    {[0, 1, 2].map(index => <div key={index} className={`${styles.pose} ${pose === index ? styles.active : ''}`} style={{ backgroundPosition: `${index * 50}% center` }} />)}
  </div><p className={styles.badge}>{tr('Ton coach virtuel EasyJob', 'Your virtual EasyJob coach', 'مدربك الافتراضي EasyJob')}</p></div>;
}

export function EasyJobCoach({ onUpgrade, onLater, finalStep }: { onUpgrade: () => void; onLater: () => void; finalStep: boolean }) {
  const tr = useReleaseText(), { locale } = useI18n();
  const [page, setPage] = useState(0), [choice, setChoice] = useState<'yes' | 'later' | null>(null);
  const [canSpeak, setCanSpeak] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setCanSpeak('speechSynthesis' in window); return () => { if (timer.current) clearTimeout(timer.current); window.speechSynthesis?.cancel(); }; }, []);
  const replies = [
    { title: tr('Bienvenue chez EasyJob !', 'Welcome to EasyJob!', 'مرحباً بك في EasyJob!'), body: tr('Salut ! Moi, c’est ton coach EasyJob. Je t’aide à préparer ton CV, trouver des offres et avancer dans ta recherche. Les recruteurs ont du travail… donnons-leur envie de te rencontrer !', 'Hi! I’m your EasyJob coach. I help you prepare your CV, discover jobs and move your search forward. Recruiters are busy… let’s give them a reason to meet you!', 'أهلاً! أنا مدربك في EasyJob. أساعدك على إعداد سيرتك واكتشاف فرص العمل والتقدم في بحثك. لنعطِ مسؤولي التوظيف سبباً لمقابلتك!') },
    { title: tr('Un coup de pouce pour ton CV ?', 'A helping hand for your CV?', 'هل تحتاج مساعدة في سيرتك؟'), body: tr('Avec une formule adaptée, tu peux améliorer ton CV avec l’IA, revoir les conseils ATS, puis exporter un PDF professionnel. Tu gardes la main : relis et valide chaque modification avant de l’envoyer.', 'With a suitable plan, you can improve your CV with AI, review ATS advice and export a professional PDF. You stay in control: review and approve each change before sending it.', 'مع الخطة المناسبة يمكنك تحسين سيرتك بالذكاء الاصطناعي ومراجعة نصائح ATS وتصدير PDF احترافي. أنت صاحب القرار: راجع كل تعديل قبل الإرسال.') },
    { title: tr('Et pour la suite ?', 'And what comes next?', 'وماذا بعد؟'), body: tr('Selon la formule, EasyJob propose aussi le matching, des recommandations et des alertes. Premium ajoute le coaching d’entretien et les candidatures automatiques sur activation. Tu veux comparer tous les tarifs maintenant, ou continuer gratuitement ?', 'Depending on the plan, EasyJob also offers matching, recommendations and alerts. Premium adds interview coaching and opt-in automatic applications. Would you like to compare all plans now, or continue for free?', 'حسب الخطة، يقدم EasyJob التوافق والتوصيات والتنبيهات. وتضيف Premium التدريب للمقابلات والتقديم التلقائي الاختياري. هل تريد مقارنة الخطط الآن أم المتابعة مجاناً؟') },
  ];
  const reply = choice === 'yes' ? { title: tr('Excellent choix !', 'Great choice!', 'اختيار رائع!'), body: tr('Allons voir les formules ensemble. Tu pourras comparer les tarifs et choisir celle qui te convient.', 'Let’s look at the plans together. Compare the prices and choose the one that suits you.', 'لنستعرض الخطط معاً. قارن الأسعار واختر الأنسب لك.') }
    : choice === 'later' ? { title: tr('Merci, et à ton rythme !', 'Thanks — at your own pace!', 'شكراً، تقدّم على راحتك!'), body: finalStep ? tr('Ton aventure EasyJob commence. Je t’emmène sur ton tableau de bord. On se retrouve là-bas !', 'Your EasyJob journey starts here. Taking you to your dashboard. See you there!', 'تبدأ رحلتك مع EasyJob الآن. ننقلك إلى لوحة التحكم. أراك هناك!') : tr('Aucun souci ! On continue ton inscription. Tu retrouveras les abonnements quand tu le souhaiteras.', 'No problem! Let’s continue your registration. The plans will be there whenever you’re ready.', 'لا مشكلة! لنكمل تسجيلك. يمكنك الاطلاع على الخطط وقتما تشاء.') } : replies[page];
  const choose = (value: 'yes' | 'later') => {
    if (choice) return;
    window.speechSynthesis?.cancel(); setChoice(value);
    timer.current = setTimeout(value === 'yes' ? onUpgrade : onLater, 2600);
  };
  const speak = () => { window.speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(`${reply.title} ${reply.body}`); speech.lang = locale === 'fr' ? 'fr-FR' : locale === 'ar' ? 'ar' : 'en-US'; speech.rate = .95; window.speechSynthesis.speak(speech); };
  const pose = choice ? 2 : page === 0 ? 0 : 1;
  return <div className={styles.scene}>
    <EasyJobCharacter pose={pose} />
    <div className={styles.dialogue}><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold tracking-widest text-indigo-200">EASYJOB · COACH</span>{canSpeak && <button type="button" onClick={speak} className="flex items-center gap-2 rounded-md p-2 text-xs text-indigo-200 hover:bg-white/10"><Volume2 className="size-4" />{tr('Écouter', 'Listen', 'استمع')}</button>}</div>
      <div className={styles.bubble} aria-live="polite" aria-atomic="true"><div key={`${page}-${choice}`} className={styles.reply}><h3>{reply.title}</h3><p>{reply.body}</p></div></div>
      {!choice ? <><div className={styles.progress} aria-label={`${page + 1} / 3`}>{replies.map((_, index) => <span key={index} className={page === index ? styles.current : ''} />)}</div><div className={styles.actions}>
        {page < 2 ? <Button type="button" onClick={() => { window.speechSynthesis?.cancel(); setPage(page + 1); }}>{page === 0 ? tr('Parle-moi du CV', 'Tell me about the CV', 'أخبرني عن السيرة') : tr('Et les autres avantages ?', 'What else is included?', 'ما المزايا الأخرى؟')}</Button> : <Button type="button" onClick={() => choose('yes')}>{tr('Oui, voir les tarifs', 'Yes, show me the plans', 'نعم، اعرض الخطط')}</Button>}
        <Button type="button" variant="outline" className="border-slate-500 bg-transparent text-slate-100 hover:bg-slate-800" onClick={() => choose('later')}>{tr('Peut-être plus tard', 'Maybe later', 'ربما لاحقاً')}</Button>
      </div>{page > 0 && <button type="button" className="self-start text-xs text-slate-400 underline" onClick={() => { window.speechSynthesis?.cancel(); setPage(page - 1); }}>{tr('Revenir à la réplique précédente', 'Previous message', 'الرسالة السابقة')}</button>}</> : <p role="status" className="text-sm text-indigo-200">{tr('On y va…', 'Let’s go…', 'هيا بنا…')}</p>}
    </div>
  </div>;
}
