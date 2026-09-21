'use client';
import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReleaseText } from '@/lib/i18n/release';
export function CompanyAccessNotice() {
  const t = useReleaseText();
  return <section className="mx-auto my-12 max-w-lg space-y-5 rounded-3xl border bg-card p-8">
    <Building2 className="size-10 text-primary" /><h1 className="text-2xl font-semibold">{t('Accès entreprise et RH', 'Company and HR access', 'دخول الشركات والموارد البشرية')}</h1>
    <p className="text-muted-foreground">{t('Les comptes entreprise sont créés exclusivement par l’administrateur EasyJob. Vos identifiants sont envoyés à votre adresse professionnelle.', 'Company accounts are created exclusively by the EasyJob administrator. Your credentials are sent to your professional email.', 'ينشئ مسؤول EasyJob حسابات الشركات حصريًا. تُرسل بيانات الدخول إلى بريدك المهني.')}</p>
    <Button asChild><Link href="/login">{t('J’ai reçu mes identifiants', 'I have my credentials', 'لدي بيانات الدخول')}</Link></Button>
    <Link href="/forgot-password" className="block text-sm underline">{t('Récupérer mon accès', 'Recover my access', 'استعادة الدخول')}</Link>
  </section>;
}
