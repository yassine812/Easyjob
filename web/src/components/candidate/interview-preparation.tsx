'use client';
import { useI18n } from '@/lib/i18n';

export function useCoachCopy() {
  const { locale } = useI18n();
  return (fr: string, en: string, ar: string) => locale === 'fr' ? fr : locale === 'ar' ? ar : en;
}
