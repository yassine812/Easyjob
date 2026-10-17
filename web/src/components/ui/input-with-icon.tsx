import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Input, type InputProps } from './input';

type InputWithIconProps = InputProps & {
  icon: ReactNode;
  iconPosition?: 'start' | 'end';
};

/**
 * Keeps decorative input icons out of the text flow while reserving enough
 * space for the placeholder and the user's value in both writing directions.
 */
export function InputWithIcon({ icon, iconPosition = 'start', className, style, ...props }: InputWithIconProps) {
  const isStart = iconPosition === 'start';

  return (
    <span className="relative block">
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-1/2 z-10 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground',
          isStart ? 'start-4' : 'end-4',
        )}
      >
        {icon}
      </span>
      <Input
        {...props}
        className={className}
        style={{
          ...style,
          ...(isStart ? { paddingInlineStart: '2.75rem' } : { paddingInlineEnd: '2.75rem' }),
        }}
      />
    </span>
  );
}
