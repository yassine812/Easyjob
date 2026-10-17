'use client';
import { useReleaseText } from '@/lib/i18n/release';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export function LanguageLevelSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const tr = useReleaseText();
  const normalized = /^(native|mother tongue|langue maternelle|maternelle|اللغة الأم)$/i.test(value.trim()) ? 'native'
    : /^(non précisé|not specified|unspecified|غير محدد)?$/i.test(value.trim()) ? ''
    : LEVELS.includes(value.trim().toUpperCase()) ? value.trim().toUpperCase() : value;
  const labels = [tr('Débutant', 'Beginner', 'مبتدئ'), tr('Élémentaire', 'Elementary', 'أساسي'), tr('Intermédiaire', 'Intermediate', 'متوسط'), tr('Intermédiaire avancé', 'Upper intermediate', 'فوق المتوسط'), tr('Avancé', 'Advanced', 'متقدم'), tr('Maîtrise', 'Proficient', 'إتقان')];
  return <select className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm" value={normalized} onChange={e => onChange(e.target.value === 'native' ? 'Langue maternelle' : e.target.value)}>
    <option value="">{tr('Choisir un niveau', 'Choose a level', 'اختر المستوى')}</option>
    {LEVELS.map((level, i) => <option key={level} value={level}>{level} — {labels[i]}</option>)}
    <option value="native">{tr('Langue maternelle', 'Native language', 'اللغة الأم')}</option>
    {normalized && normalized !== 'native' && !LEVELS.includes(normalized) && <option value={normalized}>{normalized}</option>}
  </select>;
}
