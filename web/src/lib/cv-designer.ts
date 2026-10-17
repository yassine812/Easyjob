export const cvTemplates = [
  { id: 'modern', color: '#234e68', fr: 'Horizon', en: 'Horizon', ar: 'أفق', specialty: ['Polyvalent · Recommandé', 'Versatile · Recommended', 'متعدد الاستخدامات · موصى به'] },
  { id: 'precision', color: '#30473f', fr: 'Précision', en: 'Precision', ar: 'دقة', specialty: ['Tech · Produit · Opérations', 'Tech · Product · Operations', 'تقنية · منتج · عمليات'] },
  { id: 'signature', color: '#6c5039', fr: 'Signature', en: 'Signature', ar: 'تميّز', specialty: ['Conseil · Management', 'Consulting · Management', 'استشارات · إدارة'] },
  { id: 'classic', color: '#243449', fr: 'Clarté', en: 'Clarity', ar: 'وضوح', specialty: ['Tous les métiers', 'All careers', 'كل المهن'] },
  { id: 'technology', color: '#19394b', fr: 'Studio', en: 'Studio', ar: 'ستوديو', specialty: ['Développement · Data · IT', 'Development · Data · IT', 'تطوير · بيانات · تقنية'] },
  { id: 'executive', color: '#235547', fr: 'Direction', en: 'Executive', ar: 'قيادة', specialty: ['Finance · Conseil · Direction', 'Finance · Consulting · Leadership', 'مالية · استشارات · إدارة'] },
  { id: 'academic', color: '#34302e', fr: 'Érudit', en: 'Scholar', ar: 'باحث', specialty: ['Sciences · Enseignement · Santé', 'Science · Education · Healthcare', 'علوم · تعليم · صحة'] },
  { id: 'creative', color: '#69455d', fr: 'Atelier', en: 'Atelier', ar: 'إبداع', specialty: ['Design · Communication · Marketing', 'Design · Communications · Marketing', 'تصميم · تواصل · تسويق'] },
] as const;

/** Collapse identical historical copies without discarding distinct edits. */
export function distinctCvDrafts<T extends { sourceResumeId?: string | null; targetJobId: string | null; content: string; title: string; template?: string; fontSize?: number; approvedAt: string | null }>(drafts: T[]) {
  const seen = new Set<string>();
  return drafts.filter(d => {
    const key = JSON.stringify([d.sourceResumeId, d.targetJobId, d.content.trim(), d.title, d.template || 'classic', d.fontSize || 14, Boolean(d.approvedAt)]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export type CvSection = { heading: string; body: string };
/** Only recognize headings already present in the source; never add career facts. */
export function cvSections(content: string): CvSection[] {
  const sections: CvSection[] = [{ heading: '', body: '' }];
  for (const line of content.split(/\r?\n/)) {
    if (/^##\s+/.test(line) || /^(PROFIL(?: PROFESSIONNEL)?|PROFILE|SUMMARY|RÉSUMÉ|EXPÉRIENCES?(?: PROFESSIONNELLES?)?|WORK EXPERIENCE|EDUCATION|FORMATION[S]?|COMPÉTENCES(?: TECHNIQUES)?|TECHNICAL SKILLS|SKILLS|LANGUES|LANGUAGES|CERTIFICATIONS?|PROJETS|PROJECTS|OUTILS|TOOLS|CENTRES D’INTÉRÊT|INTERESTS|المهارات|اللغات|الشهادات|الخبرة|التعليم)\s*:?$/iu.test(line.trim())) {
      sections.push({ heading: line.replace(/^##\s+/, '').trim(), body: '' });
    } else { sections[sections.length - 1].body += `${line}\n`; }
  }
  return sections.map(s => ({ ...s, body: s.body.trim() })).filter((s, i) => i === 0 || s.heading || s.body);
}
export function joinCvSections(sections: CvSection[]) {
  return sections.map(s => `${s.heading ? `## ${s.heading}\n` : ''}${s.body}`).join('\n\n');
}

/** Only position existing sections; custom headings stay in the main column. */
export function isCvSidebarSection(heading: string) {
  return /^(comp[eé]tences(?: techniques)?|technical skills|skills|langues|languages|certifications?|outils|tools|int[eé]r[eê]ts|interests|المهارات|اللغات|الشهادات)\s*:?$/iu.test(heading.trim());
}
