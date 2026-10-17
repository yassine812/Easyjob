import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import logoImg from '../../../public/easyjob-logo.png';

interface LogoProps {
  href?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ href = '/', className, size = 'md' }: LogoProps) {
  const heightClass = size === 'sm' ? 'h-11' : size === 'lg' ? 'h-16 sm:h-[68px]' : 'h-13 sm:h-14';

  return (
    <Link href={href} className={cn('inline-flex items-center gap-2 transition-opacity hover:opacity-90', className)}>
      <Image
        src={logoImg}
        alt="EasyJob"
        width={240}
        height={80}
        priority
        className={cn(heightClass, 'w-auto object-contain bg-transparent dark:invert dark:hue-rotate-180')}
      />
    </Link>
  );
}
