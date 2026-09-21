import { Inject, Injectable, Logger } from '@nestjs/common';
import { CONFIG, type AppConfig } from '../config/configuration';
import { cosineSimilarity } from './biometric.crypto';

export interface FaceQualityResult {
  passed: boolean;
  reasons: string[];
}

export interface FaceLivenessResult {
  passed: boolean;
  reason?: string;
}

export interface FaceResult {
  embedding: number[];
  quality: FaceQualityResult;
  liveness: FaceLivenessResult;
}

/** Raised when the AI face service is unreachable or returns an error. */
export class FaceServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FaceServiceUnavailableError';
  }
}

/**
 * Raised when the AI service *processed* the frames but rejected them (no
 * face, multiple faces, low quality, liveness failed). Carries the stable
 * machine code (e.g. "no_face") so NestJS can return a safe 4xx message
 * instead of claiming the service is down.
 */
export class FaceRejectedError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`Face scan rejected: ${code}`);
    this.name = 'FaceRejectedError';
    this.code = code;
  }
}

/**
 * Calls the FastAPI face endpoints. The browser never talks to the AI service:
 * frames go NestJS → FastAPI (Bearer AI_API_KEY), embeddings return here, and
 * the authentication decision is made entirely in NestJS.
 */
@Injectable()
export class FaceClient {
  private readonly logger = new Logger(FaceClient.name);

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  private async postFrames(path: string, frames: Buffer[]): Promise<FaceResult> {
    const form = new FormData();
    frames.forEach((frame, i) => {
      const bytes = frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength) as ArrayBuffer;
      form.append(i === 0 ? 'frame_a' : 'frame_b', new Blob([bytes], { type: 'image/jpeg' }), `frame_${i}.jpg`);
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.ai.timeoutMs);
    try {
      const response = await fetch(`${this.config.biometric.faceServiceUrl}${path}`, {
        method: 'POST',
        headers: this.config.ai.apiKey ? { Authorization: `Bearer ${this.config.ai.apiKey}` } : {},
        body: form,
        signal: controller.signal,
      });
      const text = await response.text().catch(() => '');
      if (!response.ok) {
        // 422 carries the structured rejection code from the AI router
        // (invalid_image, no_face, multiple_faces, low_quality, ...).
        if (response.status === 422) {
          let code = 'low_quality';
          try {
            const parsed = JSON.parse(text) as { detail?: { code?: string } | string };
            const detail = parsed.detail;
            if (typeof detail === 'object' && detail?.code) code = detail.code;
          } catch {
            /* keep the default */
          }
          throw new FaceRejectedError(code);
        }
        throw new FaceServiceUnavailableError(
          `AI face service error ${response.status}: ${text.slice(0, 200) || 'unknown'}`,
        );
      }
      let parsed: FaceResult;
      try {
        parsed = JSON.parse(text) as FaceResult;
      } catch {
        throw new FaceServiceUnavailableError('AI face service returned an invalid response');
      }
      if (!Array.isArray(parsed.embedding) || parsed.embedding.length === 0) {
        throw new FaceServiceUnavailableError('AI face service returned an empty embedding');
      }
      return parsed;
    } catch (err) {
      if (err instanceof FaceServiceUnavailableError) throw err;
      if (err instanceof FaceRejectedError) throw err;
      throw new FaceServiceUnavailableError((err as Error).message);
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Enrollment: validates quality + liveness and returns the embedding. */
  async enroll(frames: Buffer[]): Promise<FaceResult> {
    const first = await this.postFrames('/ai/face/enroll', frames.slice(0, 2));
    if (frames[2]) {
      const second = await this.postFrames('/ai/face/enroll', [frames[0], frames[2]]);
      if (!second.quality.passed) throw new FaceRejectedError('low_quality');
      if (!second.liveness.passed) throw new FaceRejectedError('liveness_failed');
      if (cosineSimilarity(first.embedding, second.embedding) < this.config.biometric.matchThreshold) throw new FaceRejectedError('face_count_changed');
    }
    return first;
  }

  /** Enrollment reference: validates one profile photo and extracts its embedding. */
  reference(photo: Buffer): Promise<FaceResult> {
    return this.postFrames('/ai/face/reference', [photo]);
  }

  /** Login: computes an embedding from live frames (quality + liveness checked). */
  embed(frames: Buffer[]): Promise<FaceResult> {
    return this.postFrames('/ai/face/embed', frames);
  }
}
