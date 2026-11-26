import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Each third of the original artwork is one complete pose of the same coach. */
export function HumanCoach({ className, pose = 0, label = '' }: {
  className?: string;
  pose?: 0 | 1 | 2;
  label?: string;
}) {
  return <span className={cn('human-coach', className)}>
    <Image src="/images/coach/easyjob-human-transparent.png?v=original-9146880"
      alt={label} width={2172} height={724} unoptimized
      className="human-coach__image" style={{ left: `${pose * -100}%` }} />
  </span>;
}
