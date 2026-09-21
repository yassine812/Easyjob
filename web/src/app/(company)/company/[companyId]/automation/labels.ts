export const AUTOMATION_TRIGGER_LABELS: Record<string, string> = {
  CANDIDATE_APPLIED: 'Candidate applies',
  APPLICATION_STATUS_CHANGED: 'Application status changes',
  CANDIDATE_MATCH_SCORE_UPDATED: 'Match score updated',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
  JOB_EXPIRING: 'Job expiring',
};

export const AUTOMATION_ACTION_LABELS: Record<string, string> = {
  send_notification: 'Send team notification',
  send_email: 'Send email',
  move_application: 'Move application',
  notify_recruiter: 'Notify recruiter',
};
