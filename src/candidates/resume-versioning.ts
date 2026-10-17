type ResumeLike = { id: string; createdAt?: Date | string; design?: unknown };

export type ResumeDesignIdentity = {
  logicalCvId?: string;
  sourceResumeId?: string;
  draftId?: string;
  draftVersion?: number;
  restoredFromResumeId?: string;
  language?: string;
  locale?: string;
  market?: string;
  variantGroupId?: string;
  [key: string]: unknown;
};

export function resumeDesign(value: unknown): ResumeDesignIdentity {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ResumeDesignIdentity : {};
}

export function resumeLocale(resume: ResumeLike): string {
  const design = resumeDesign(resume.design), locale = design.locale ?? design.language;
  if (locale === 'fr') return 'fr-FR';
  if (locale === 'en') return 'en-US';
  return typeof locale === 'string' && /^(fr-FR|fr-CA|en-CA|en-US|en-GB|es-ES|de-DE|it-IT|pt-PT|pt-BR|nl-NL|ar-TN)$/.test(locale) ? locale : 'fr-FR';
}

/** Resolve legacy source/draft links as well as the explicit identity written by new versions. */
export function logicalResumeId<T extends ResumeLike>(resume: T, rows: T[]): string {
  const byId = new Map(rows.map(row => [row.id, row]));
  const visit = (row: T, seen = new Set<string>()): string => {
    if (seen.has(row.id)) return `resume:${row.id}`;
    seen.add(row.id);
    const design = resumeDesign(row.design);
    if (design.logicalCvId) return design.logicalCvId;
    if (design.sourceResumeId && byId.has(design.sourceResumeId)) return visit(byId.get(design.sourceResumeId)!, seen);
    if (design.sourceResumeId) return `resume:${design.sourceResumeId}`;
    if (design.draftId) return `draft:${design.draftId}`;
    return `resume:${row.id}`;
  };
  return visit(resume);
}

export function resumeGroups<T extends ResumeLike>(rows: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = logicalResumeId(row, rows);
    groups.set(id, [...(groups.get(id) ?? []), row]);
  }
  for (const versions of groups.values()) versions.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  return groups;
}
