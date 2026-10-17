import type { Application, ApplicationStatus } from '@/types/api';

export type ProgressState = 'done' | 'active' | 'waiting' | 'failed';
export function applicationProgress(data: Application) {
  const terminal = ['HIRED', 'REJECTED', 'WITHDRAWN'].includes(data.status);
  const ended = ['REJECTED', 'WITHDRAWN'].includes(data.status);
  const eventAt = (statuses: ApplicationStatus[]) => data.events?.find(event => statuses.includes(event.newStatus))?.createdAt;
  const reviewStatuses: ApplicationStatus[] = ['UNDER_REVIEW', 'SHORTLISTED', 'ASSESSMENT'];
  const reviewedAt = eventAt(reviewStatuses);
  const interview = data.interviews?.find(item => ['SCHEDULED', 'CONFIRMED', 'COMPLETED'].includes(item.status));
  const interviewAt = eventAt(['INTERVIEW']);
  const offerAt = eventAt(['OFFER']);
  const analyzed = data.aiScreeningStatus === 'COMPLETED';
  const steps: { key: string; state: ProgressState; date?: string | null }[] = [
    { key: 'APPLIED', state: 'done', date: data.appliedAt },
    { key: 'SCREENING', state: analyzed ? 'done' : data.aiScreeningStatus === 'FAILED' ? 'failed' : !terminal && data.aiScreeningStatus === 'PROCESSING' ? 'active' : 'waiting', date: analyzed ? data.aiScreenedAt : undefined },
    { key: 'recruiterReview', state: !terminal && reviewStatuses.includes(data.status) ? 'active' : reviewedAt ? 'done' : 'waiting', date: reviewedAt || (reviewStatuses.includes(data.status) ? data.stageChangedAt : undefined) },
    { key: 'INTERVIEW', state: interview?.status === 'COMPLETED' ? 'done' : !terminal && (data.status === 'INTERVIEW' || (!!interview && !['OFFER', 'HIRED'].includes(data.status))) ? 'active' : interviewAt && ['OFFER', 'HIRED'].includes(data.status) ? 'done' : 'waiting', date: interview?.startAt || interviewAt },
    { key: 'OFFER', state: data.status === 'OFFER' ? 'active' : offerAt ? 'done' : 'waiting', date: offerAt || (data.status === 'OFFER' ? data.stageChangedAt : undefined) },
    { key: 'HIRED', state: data.status === 'HIRED' ? 'done' : 'waiting', date: data.status === 'HIRED' ? data.stageChangedAt : undefined },
  ];
  const message = ended ? data.status : data.status === 'HIRED' ? 'HIRED' : data.aiScreeningStatus === 'FAILED' ? 'analysisNeedsAttention'
    : ['APPLIED', 'SCREENING'].includes(data.status) ? analyzed ? 'awaitingRecruiter' : 'analysisAutomatic'
      : data.status === 'INTERVIEW' || interview && !['OFFER', 'HIRED'].includes(data.status) ? 'interviewNext' : data.status === 'OFFER' ? 'offerReceived' : 'reviewInProgress';
  return { steps, message, ended, terminal };
}
