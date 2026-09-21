'use client';
import { useI18n } from './index';
export function useReleaseText() {
  const { locale } = useI18n();
  return (fr: string, en: string, ar: string) => locale === 'fr' ? fr : locale === 'ar' ? ar : en;
}
