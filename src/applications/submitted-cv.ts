import { randomUUID } from 'crypto';
import { StorageService } from '../files/storage.service';

export type SubmittedCv = { storageKey: string; filename: string; mimeType: string; fileSize: number; version: number; resumeId: string; submittedAt: string };
export function submittedCv(snapshot: unknown): SubmittedCv | null {
  const file = (snapshot as { submittedCv?: SubmittedCv } | null)?.submittedCv;
  return file?.storageKey?.startsWith('application-cvs/') && file.filename && file.mimeType ? file : null;
}
export async function copySubmittedCv(storage: StorageService, resume: { id: string; storageKey: string; filename: string; mimeType: string; version: number }): Promise<SubmittedCv> {
  const bytes = await storage.getBytes(resume.storageKey);
  // Local downloads infer Content-Type from the extension, as do some viewers.
  const safeName = resume.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-160);
  const storageKey = `application-cvs/${randomUUID()}/${resume.id}-${safeName}`;
  await storage.put(storageKey, bytes, resume.mimeType);
  return { storageKey, filename: resume.filename, mimeType: resume.mimeType, fileSize: bytes.length, version: resume.version, resumeId: resume.id, submittedAt: new Date().toISOString() };
}
export function publicSubmittedCv(snapshot: unknown) {
  const file = submittedCv(snapshot);
  if (!file) return null;
  const { storageKey: _private, ...metadata } = file;
  return metadata;
}
