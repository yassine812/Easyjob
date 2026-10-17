import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MarkSize = 'sm' | 'md' | 'lg';
type MarkProps = Omit<ComponentProps<'svg'>, 'children'> & { size?: MarkSize };
const dimensions = { sm: 16, md: 20, lg: 28 };

/** The symbol from the official logo, cropped through its SVG viewport (no alternate artwork). */
export function EasyJobFeatureMark({ size = 'sm', className, ...props }: MarkProps) {
  return <svg aria-hidden="true" focusable="false" {...props} data-easyjob-mark="" viewBox="300 165 425 460" width={dimensions[size]} height={dimensions[size]} className={cn('inline-block shrink-0 align-middle dark:invert dark:hue-rotate-180', className)}>
    <image href="/easyjob-logo.png" width="1024" height="1024" />
  </svg>;
}

export function EasyJobFeatureLabel({ children, size = 'sm', className }: { children: ReactNode; size?: MarkSize; className?: string }) {
  return <span className={cn('inline-flex items-center gap-2', className)}><EasyJobFeatureMark size={size} /><span>{children}</span></span>;
}
