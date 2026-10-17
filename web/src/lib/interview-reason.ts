export interface QuestionReason {
  reason_type: 'MISSING_EVIDENCE' | 'WEAK_EVIDENCE' | 'STRONG_EVIDENCE' | 'TRANSFERABLE' | 'SENIORITY' | 'GENERAL';
  skill?: string;
  requirement_importance?: string;
  evidence_count?: number;
  source_types: ('JOB' | 'CV' | 'INTERVIEW')[];
  excerpts?: { source: 'JOB' | 'CV'; text: string }[];
  transferable_from?: string;
  seniority?: string;
}

const copy = {
  fr: {
    why: 'Pourquoi EasyJob la suggère', sources: 'Sources', evidence: 'Voir la preuve',
    JOB: 'Offre', CV: 'CV', INTERVIEW: 'Type d’entretien', skill: 'cette compétence',
    tags: { MISSING_EVIDENCE: 'Compétence à vérifier', WEAK_EVIDENCE: 'Preuve limitée', STRONG_EVIDENCE: 'Force à confirmer', TRANSFERABLE: 'Compétence transférable', SENIORITY: 'Niveau à confirmer', GENERAL: 'À explorer' },
    MISSING_EVIDENCE: 'L’offre mentionne {skill}, mais le CV analysé ne permet pas d’en vérifier la pratique. Cette question aide à clarifier l’expérience du candidat.',
    WEAK_EVIDENCE: 'Le CV mentionne {skill}, avec peu d’éléments concrets sur sa mise en pratique. Cette question aide à préciser les réalisations et le niveau d’autonomie.',
    STRONG_EVIDENCE: 'Le CV présente des éléments concrets sur {skill}. Cette question permet d’approfondir ce point fort et de comprendre les décisions prises.',
    TRANSFERABLE: 'L’expérience documentée en {from} peut être pertinente pour {skill}. Cette question vérifie ce qui est transférable et les apprentissages nécessaires.',
    SENIORITY: 'Cette question permet de vérifier le niveau {level} attendu pour le poste, notamment l’autonomie, les responsabilités et les compromis évalués.',
    GENERAL: 'Cette question aide à préparer l’échange et à préciser l’expérience du candidat. Elle ne constitue pas une conclusion sur ses compétences.',
    required: 'Compétence requise', preferred: 'Compétence souhaitée', optional: 'Compétence complémentaire',
  },
  en: {
    why: 'Why EasyJob suggests it', sources: 'Sources', evidence: 'View evidence',
    JOB: 'Job', CV: 'CV', INTERVIEW: 'Interview type', skill: 'this skill',
    tags: { MISSING_EVIDENCE: 'Skill to verify', WEAK_EVIDENCE: 'Limited evidence', STRONG_EVIDENCE: 'Strength to confirm', TRANSFERABLE: 'Transferable skill', SENIORITY: 'Level to confirm', GENERAL: 'To explore' },
    MISSING_EVIDENCE: 'The job mentions {skill}, but the analyzed CV does not establish practical experience. This question helps clarify the candidate’s experience.',
    WEAK_EVIDENCE: 'The CV mentions {skill}, with limited concrete evidence of its use. This question helps clarify achievements and autonomy.',
    STRONG_EVIDENCE: 'The CV provides concrete evidence of {skill}. This question explores that strength and the decisions behind it.',
    TRANSFERABLE: 'Documented experience with {from} may be relevant to {skill}. This question checks what transfers and what still needs to be learned.',
    SENIORITY: 'This question checks the {level} level expected for the role, including autonomy, ownership and trade-offs.',
    GENERAL: 'This question helps prepare the conversation and clarify the candidate’s experience. It is not a conclusion about their skills.',
    required: 'Required skill', preferred: 'Preferred skill', optional: 'Additional skill',
  },
  ar: {
    why: 'لماذا يقترحها EasyJob', sources: 'المصادر', evidence: 'عرض الدليل',
    JOB: 'العرض', CV: 'السيرة الذاتية', INTERVIEW: 'نوع المقابلة', skill: 'هذه المهارة',
    tags: { MISSING_EVIDENCE: 'مهارة للتحقق', WEAK_EVIDENCE: 'أدلة محدودة', STRONG_EVIDENCE: 'نقطة قوة للتأكيد', TRANSFERABLE: 'مهارة قابلة للنقل', SENIORITY: 'مستوى للتأكيد', GENERAL: 'للاستكشاف' },
    MISSING_EVIDENCE: 'يذكر العرض {skill}، لكن السيرة الذاتية المحللة لا تثبت الممارسة العملية. يساعد هذا السؤال على توضيح خبرة المرشح.',
    WEAK_EVIDENCE: 'تذكر السيرة الذاتية {skill} مع أدلة عملية محدودة. يساعد هذا السؤال على توضيح الإنجازات ومستوى الاستقلالية.',
    STRONG_EVIDENCE: 'تقدم السيرة الذاتية أدلة ملموسة على {skill}. يتيح هذا السؤال التعمق في نقطة القوة وفهم القرارات المتخذة.',
    TRANSFERABLE: 'قد تكون الخبرة الموثقة في {from} مفيدة في {skill}. يتحقق هذا السؤال مما يمكن نقله وما يحتاج إلى تعلم.',
    SENIORITY: 'يتحقق هذا السؤال من مستوى {level} المطلوب للدور، بما في ذلك الاستقلالية والمسؤوليات والمفاضلات.',
    GENERAL: 'يساعد هذا السؤال على التحضير للنقاش وتوضيح خبرة المرشح. ولا يمثل استنتاجاً بشأن مهاراته.',
    required: 'مهارة مطلوبة', preferred: 'مهارة مفضلة', optional: 'مهارة إضافية',
  },
};
const skillLabels: Record<string, [string, string, string]> = {
  'backend development': ['le développement backend', 'backend development', 'تطوير الأنظمة الخلفية'],
  'production debugging': ['le diagnostic en production', 'production debugging', 'تشخيص مشاكل الإنتاج'],
  'api development': ['le développement d’API', 'API development', 'تطوير واجهات البرمجة'],
  'system design': ['la conception de systèmes', 'system design', 'تصميم الأنظمة'],
  'testing': ['les tests logiciels', 'software testing', 'اختبار البرمجيات'],
  'authentication': ['l’authentification', 'authentication', 'المصادقة'],
  'teamwork': ['le travail en équipe', 'teamwork', 'العمل الجماعي'],
  'communication': ['la communication', 'communication', 'التواصل'],
};
const clean = (value?: string) => value?.replace(/^custom[_ ]+/i, '').trim();
export function presentQuestionReason(reason: QuestionReason | null | undefined, locale: string) {
  const language = locale === 'en' || locale === 'ar' ? locale : 'fr';
  const t = copy[language], index = language === 'fr' ? 0 : language === 'en' ? 1 : 2;
  const label = (value?: string) => { const text = clean(value); return text ? skillLabels[text.toLowerCase()]?.[index] ?? text : t.skill; };
  let kind = reason?.reason_type && Object.hasOwn(t.tags, reason.reason_type) ? reason.reason_type : 'GENERAL';
  // Never infer a transfer or seniority claim without the corresponding structured data.
  if ((kind === 'TRANSFERABLE' && (!reason?.transferable_from || !reason.excerpts?.length)) || (kind === 'SENIORITY' && !reason?.seniority)) kind = 'GENERAL';
  const levels: Record<string, [string, string, string]> = { JUNIOR: ['Junior', 'Junior', 'مبتدئ'], MID: ['Intermédiaire', 'Mid-level', 'متوسط'], SENIOR: ['Senior', 'Senior', 'متقدم'], LEAD: ['Lead', 'Lead', 'قيادي'] };
  const level = levels[reason?.seniority?.toUpperCase() ?? '']?.[index];
  if (kind === 'SENIORITY' && !level) kind = 'GENERAL';
  const text = t[kind].replace('{skill}', label(reason?.skill)).replace('{from}', label(reason?.transferable_from)).replace('{level}', level ?? '');
  const importance = reason?.requirement_importance === 'REQUIRED' ? t.required : reason?.requirement_importance === 'PREFERRED' ? t.preferred : reason?.requirement_importance === 'OPTIONAL' ? t.optional : null;
  return { ...t, tag: kind === 'SENIORITY' ? `${t.tags[kind]} · ${level}` : t.tags[kind], text, importance,
    sourceLabels: [...new Set(reason?.source_types ?? [])].filter(source => ['JOB', 'CV', 'INTERVIEW'].includes(source)).map(source => t[source]),
    excerpts: (reason?.excerpts ?? []).filter(item => ['JOB', 'CV'].includes(item.source) && item.text.trim()).map(item => ({ text: item.text, source: t[item.source] })),
  };
}
