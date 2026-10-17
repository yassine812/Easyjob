export type SkillExecutionStatus = 'COMPLETED' | 'FALLBACK' | 'FAILED';

export interface SkillContext {
  userId: string;
  companyId?: string;
  jobId?: string;
  applicationId?: string;
  interviewId?: string;
  locale: 'fr' | 'en' | 'ar';
  permissions: string[];
  input: Record<string, unknown>;
}

export interface SkillDefinition<TInput extends Record<string, unknown> = Record<string, unknown>, TOutput = unknown> {
  name: string;
  version: string;
  purpose: string;
  requiredPermissions?: string[];
  timeoutMs?: number;
  execute: (context: SkillContext & { input: TInput }) => Promise<TOutput> | TOutput;
  validateInput?: (input: Record<string, unknown>) => string[];
  validateOutput?: (output: unknown) => string[];
  fallback?: (context: SkillContext & { input: TInput }, error: unknown) => Promise<TOutput> | TOutput;
}

export interface SkillExecution<T = unknown> {
  skill: string;
  version: string;
  status: SkillExecutionStatus;
  durationMs: number;
  output?: T;
  error?: string;
}
