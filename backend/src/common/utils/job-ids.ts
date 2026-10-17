/**
 * BullMQ forbids ':' inside custom jobIds (it only tolerates exactly three
 * colon-separated segments, a legacy repeatable-job quirk). All queue jobIds
 * and dedupe keys are sanitized here so data-derived keys can never break
 * enqueueing. Replacing ':' with '-' preserves dedupe semantics.
 */
export function safeJobId(key: string): string {
  return key.replace(/:/g, '-');
}
