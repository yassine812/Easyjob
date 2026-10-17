import { Inject, Injectable, Logger } from '@nestjs/common';
import { CONFIG, type AppConfig } from '../config/configuration';

export interface CvAnalysisResult {
  overall_score: number;
  strengths: string[];
  weaknesses: string[];
  missing_skills: string[];
  ats_compatibility: number;
  improvement_suggestions: string[];
  structure_quality: string;
  keyword_recommendations: string[];
}

export interface MatchResult {
  skill_match: number;
  experience_match: number;
  location_match: number;
  seniority_match: number;
  overall_match: number;
  reasoning: string;
}

export interface GenerateResult {
  cv_markdown: string;
}

export interface CoverLetterResult {
  cover_letter: string;
}

export interface InterviewResult {
  questions: string[];
}

export interface TailorResult {
  tailored_cv: string;
}
export interface TranslateCvResult { document: Record<string, unknown>; translated: boolean; method: string }

export interface JobAnalysisResult {
  summary: string;
  key_skills: string[];
  suggested_titles: string[];
}

/**
 * Frontend never talks to the AI service directly: NestJS → BullMQ → FastAPI.
 * This client is only used by the AI/CV workers.
 */
@Injectable()
export class AiClient {
  private readonly logger = new Logger(AiClient.name);

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.ai.timeoutMs);
    try {
      const response = await fetch(`${this.config.ai.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.ai.apiKey ? { Authorization: `Bearer ${this.config.ai.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`AI service error ${response.status}: ${text.slice(0, 300)}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async extractText(filename: string, bytes: Buffer): Promise<string> {
    const form = new FormData();
    const blob = new Blob([bytes as unknown as BlobPart], { type: contentTypeFor(filename) });
    form.append('file', blob, filename);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.ai.timeoutMs);
    try {
      const response = await fetch(`${this.config.ai.baseUrl}/ai/cv/extract`, {
        method: 'POST',
        headers: {
          ...(this.config.ai.apiKey ? { Authorization: `Bearer ${this.config.ai.apiKey}` } : {}),
        },
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`AI extraction error ${response.status}: ${text.slice(0, 300)}`);
      }
      const data = (await response.json()) as { text?: string };
      if (!data.text) throw new Error('AI extraction returned no text');
      return data.text;
    } finally {
      clearTimeout(timeout);
    }
  }

  analyzeCv(input: { text: string; filename?: string }): Promise<CvAnalysisResult> {
    return this.post<CvAnalysisResult>('/ai/cv/analyze', input);
  }

  renderCvPdf(input: { content: string; template: string; fontSize: number; html?: string; css?: string; margin?: number }): Promise<{ pdfBase64: string; inspection: Record<string, unknown> & { text: string }; layout: string }> {
    return this.post('/ai/cv/render-pdf', input);
  }

  async inspectPdf(bytes: Buffer): Promise<Record<string, unknown>> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), 'cv.pdf');
    const response = await fetch(`${this.config.ai.baseUrl}/ai/cv/inspect-pdf`, { method: 'POST', body: form, signal: AbortSignal.timeout(this.config.ai.timeoutMs), headers: this.config.ai.apiKey ? { Authorization: `Bearer ${this.config.ai.apiKey}` } : {} });
    if (!response.ok) throw new Error('PDF inspection unavailable');
    return response.json() as Promise<Record<string, unknown>>;
  }

  generateCv(profile: Record<string, unknown>): Promise<GenerateResult> {
    return this.post<GenerateResult>('/ai/cv/generate', { profile });
  }

  tailorCv(input: { cv_text: string; job: Record<string, unknown> }): Promise<TailorResult> {
    return this.post<TailorResult>('/ai/cv/tailor', input);
  }

  translateCv(input: { document: Record<string, unknown>; sourceLocale: string; targetLocale: string; sourceLanguage?: string; targetLanguage?: string; professionalDomain?: string; seniority?: string }): Promise<TranslateCvResult> {
    const sourceLanguage = input.sourceLanguage ?? input.sourceLocale.slice(0, 2);
    const targetLanguage = input.targetLanguage ?? input.targetLocale.slice(0, 2);
    return this.post<TranslateCvResult>('/ai/cv/translate', { ...input, sourceLanguage, targetLanguage });
  }

  analyzeJob(job: Record<string, unknown>): Promise<JobAnalysisResult> {
    return this.post<JobAnalysisResult>('/ai/job/analyze', { job });
  }

  match(candidate: Record<string, unknown>, job: Record<string, unknown>): Promise<MatchResult> {
    return this.post<MatchResult>('/ai/match', { candidate, job });
  }

  coverLetter(candidate: Record<string, unknown>, job: Record<string, unknown>): Promise<CoverLetterResult> {
    return this.post<CoverLetterResult>('/ai/cover-letter', { candidate, job });
  }

  interviewPrep(job: Record<string, unknown>, candidate: Record<string, unknown>): Promise<InterviewResult> {
    return this.post<InterviewResult>('/ai/interview', { job, candidate });
  }

  careerCoach(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.post('/ai/career/coach', payload);
  }
  recruitment(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.post('/ai/recruitment', payload);
  }

  async careerVision(bytes: Buffer, mimeType: string): Promise<Record<string, unknown>> {
    const form = new FormData();
    form.append('frame', new Blob([new Uint8Array(bytes)], { type: mimeType }), 'frame.jpg');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.ai.timeoutMs);
    try {
      const response = await fetch(`${this.config.ai.baseUrl}/ai/career/vision`, { method: 'POST', body: form,
        headers: this.config.ai.apiKey ? { Authorization: `Bearer ${this.config.ai.apiKey}` } : {}, signal: controller.signal });
      if (!response.ok) throw new Error('Camera coaching unavailable');
      return await response.json() as Record<string, unknown>;
    } finally { clearTimeout(timeout); }
  }
}

function contentTypeFor(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return 'text/plain';
  return 'application/octet-stream';
}
