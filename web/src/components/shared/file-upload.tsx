'use client';

import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/webp',
];

export const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'md', 'png', 'jpg', 'jpeg', 'webp'];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB (server-enforced too)

export function validateFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return 'Unsupported file type. Allowed: PDF, DOC, DOCX, TXT, MD, PNG, JPG, WEBP.';
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type) && !['text/plain', 'text/markdown'].includes(file.type)) {
    // Some browsers report empty MIME for .md/.txt — extension check above is the UX guard;
    // the server validates content (magic bytes) as the final authority.
  }
  if (file.size === 0) return 'The file is empty.';
  if (file.size > MAX_FILE_SIZE) return 'File is larger than 10 MB.';
  return null;
}

export function FileUpload({
  accept = '.pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.webp',
  onSelect,
  selectedName,
  className,
}: {
  accept?: string;
  onSelect: (file: File | null) => void;
  selectedName?: string | null;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      onSelect(null);
      return;
    }
    const err = validateFile(file);
    if (err) {
      setError(err);
      onSelect(null);
      e.target.value = '';
      return;
    }
    setError(null);
    onSelect(file);
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
          'hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
        aria-label="Choose a file to upload"
      >
        <UploadCloud className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">{selectedName ?? 'Click to choose a file'}</p>
        <p className="text-xs text-muted-foreground">
          PDF, DOC, DOCX, TXT, MD, PNG, JPG, WEBP · max 10 MB
        </p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleChange}
        aria-hidden="true"
      />
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
