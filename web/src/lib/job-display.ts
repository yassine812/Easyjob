export type JobDisplayStatus = 'active' | 'paused' | 'draft' | 'closed';

export function toJobDisplayStatus(status: string | null | undefined): JobDisplayStatus {
  const value = String(status ?? '').trim().toUpperCase();
  if (['PUBLISHED', 'APPROVED', 'ACTIVE'].includes(value)) return 'active';
  if (['PAUSED', 'SUSPENDED'].includes(value)) return 'paused';
  if (['DRAFT', 'PENDING_APPROVAL'].includes(value)) return 'draft';
  return 'closed';
}

export function workModeKey(mode: string | null | undefined, remote = false): 'REMOTE' | 'HYBRID' | 'ONSITE' {
  const value = String(mode ?? '').trim().toUpperCase().replace('-', '_');
  if (value === 'REMOTE') return 'REMOTE';
  if (value === 'HYBRID') return 'HYBRID';
  if (value === 'ON_SITE' || value === 'ONSITE') return 'ONSITE';
  return remote ? 'REMOTE' : 'ONSITE';
}

export function employmentTypeKey(value: string | null | undefined): string | undefined {
  const normalized = String(value ?? '').trim().toUpperCase();
  return ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'].includes(normalized) ? normalized : undefined;
}

export type PublicJobViewMode = 'recruiter-preview' | 'candidate' | 'login';

export function publicJobViewMode(isCompanyOwner: boolean, isCandidate: boolean): PublicJobViewMode {
  if (isCompanyOwner) return 'recruiter-preview';
  return isCandidate ? 'candidate' : 'login';
}

export function recruiterJobsRoute(companyId: string): string {
  return `/company/${encodeURIComponent(companyId)}/jobs`;
}

export function recruiterJobRoute(companyId: string, jobId: string): string {
  return `${recruiterJobsRoute(companyId)}/${encodeURIComponent(jobId)}`;
}

export function recruiterJobApplicationsRoute(companyId: string, jobId: string): string {
  return `${recruiterJobRoute(companyId, jobId)}/applications`;
}

export function recruiterJobPreviewRoute(companyId: string, jobId: string): string {
  return `${recruiterJobRoute(companyId, jobId)}/preview`;
}

export function recruiterJobEditRoute(companyId: string, jobId: string): string {
  return `${recruiterJobRoute(companyId, jobId)}/edit`;
}
