import { api } from './client';
import type { AtsReport, AtsCriterion } from './career';
import type { CvDocument, CvLocale, InterviewQuestion } from '../cv-contract/cv-document';
export type { CvDocument, CvEntry, CvBullet, CvStyle, DocumentSection, SectionType, CvLocale } from '../cv-contract/cv-document';
export { blankDocument, newEntry, newSection, newId, sectionTypes, sectionNames, sectionLabels, languageForLocale, cvLanguageCatalog, documentText } from '../cv-contract/cv-document';
export { renderDocument, templateNames } from '../cv-contract/cv-document-render';
export { cvTemplateCatalog, templateDefinition } from '../cv-contract/cv-template-catalog';
export type { CvBlock } from '../cv-contract/cv-document-render';
export type StudioIssue = AtsCriterion & { sectionId?: string; entryId?: string; bulletId?: string; severity: 'strong' | 'important' | 'opportunity' };
export interface StudioDraft { id: string; title: string; template: string; version: number; document: CvDocument; updatedAt: string; report: AtsReport; issues: StudioIssue[]; nextQuestion: InterviewQuestion | null; approvedAt: string | null; sourceResumeId?: string | null; targetJobId?: string | null; beforeScore: number | null }
export type StudioListItem = Pick<StudioDraft, 'id' | 'title' | 'template' | 'version' | 'updatedAt' | 'sourceResumeId'> & { locale: CvLocale; variantGroupId: string | null; afterScore: number | null; interview: boolean };
export type SuggestTarget = { sectionId?: string; entryId?: string; bulletId?: string; sectionType?: string; facts?: string; instruction?: string; currentSuggestion?: string; alternativeIndex?: number };
export interface StudioProposal { document: CvDocument; before: string; after: string; changed: boolean; reason: string; question: string | null; category?: 'reorder' | 'rewrite' | 'add_if_true'; beforeScore?: number | null; report: AtsReport; sectionId?: string; entryId?: string; bulletId?: string; alternativeIndex?: number }
export interface WritingIssue { id: string; blockId: string; field: string; offset: number; length: number; before: string; replacement: string | null; message: string; category: 'spelling' | 'grammar' | 'punctuation' | 'repetition'; provider: 'languagetool' | 'local' }
export interface WritingQuality { locale: string; provider: 'languagetool' | 'local'; issues: WritingIssue[]; dimensions: string[] }
const base = '/career/cv-studio';
export const studioApi = {
  list: () => api.get<StudioListItem[]>(base),
  start: (values: { mode: string; resumeId?: string; draftId?: string; jobId?: string; title?: string }) => api.post<StudioDraft>(base, values),
  get: (id: string) => api.get<StudioDraft>(`${base}/${id}`),
  save: (id: string, values: { expectedVersion: number; title: string; template: string; document: CvDocument; approve?: boolean; checkpoint?: boolean }) => api.patch<StudioDraft>(`${base}/${id}`, values),
  answer: (id: string, values: { expectedVersion: number; key: string; answer: string }) => api.post<StudioDraft>(`${base}/${id}/interview`, values),
  suggest: (id: string, values: SuggestTarget & { expectedVersion: number }) => api.post<StudioProposal>(`${base}/${id}/suggest`, values),
  restore: (id: string, revisionId: string, expectedVersion: number) => api.post<StudioDraft>(`${base}/${id}/revisions/${revisionId}/restore`, { expectedVersion }),
  duplicate: (id: string) => api.post<StudioDraft>(`${base}/${id}/duplicate`),
  variant: (id: string, locale: string, mode: 'labels' | 'full') => api.post<StudioDraft & { translation: { requested: string; translated: boolean; method: string } }>(`${base}/${id}/variant`, { locale, mode }),
  writingQuality: (id: string) => api.post<WritingQuality>(`${base}/${id}/writing-quality`),
  export: (id: string) => api.post<{ pdfBase64: string }>(`${base}/${id}/export`),
  publish: (id: string) => api.post<{ id: string }>(`${base}/${id}/publish`),
};
export function downloadStudioPdf(file: { pdfBase64: string }, name: string) {
  const bytes = Uint8Array.from(atob(file.pdfBase64), char => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const link = document.createElement('a'); link.href = url; link.download = `${name}.pdf`; link.click(); URL.revokeObjectURL(url);
}
