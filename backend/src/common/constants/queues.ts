export const QUEUES = {
  EMAIL: 'email',
  NOTIFICATIONS: 'notifications',
  AI: 'ai',
  CV_PROCESSING: 'cv-processing',
  ANALYTICS: 'analytics',
  AUTOMATION: 'automation',
  JOB_SOURCES: 'job-sources',
  EXTERNAL_RESEARCH: 'external-research',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
