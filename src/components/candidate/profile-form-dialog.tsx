'use client';

import type { ReactNode } from 'react';
import { DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** Shared responsive shell for candidate profile forms. */
export const profileFormDialogClass = 'flex !inset-0 h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:!inset-auto sm:!left-1/2 sm:!top-1/2 sm:h-auto sm:max-h-[min(85vh,800px)] sm:w-[calc(100vw-2rem)] sm:max-w-none sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl lg:w-[min(960px,calc(100vw-64px))]';

export function ProfileFormDialog({ children, className }: { children: ReactNode; className?: string }) {
  return <DialogContent className={cn(profileFormDialogClass, className)}>{children}</DialogContent>;
}

