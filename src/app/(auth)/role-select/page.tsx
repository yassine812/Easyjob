'use client';

import Link from 'next/link';
import { ArrowRight, Briefcase, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useReleaseText } from '@/lib/i18n/release';

export default function RoleSelectPage() {
  const tr = useReleaseText();
  return (
    <div className="text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{tr('Bienvenue chez EasyJob', 'Welcome to EasyJob', 'مرحباً بك في EasyJob')}</h1>
      <p className="mt-2 text-muted-foreground">{tr('Comment veux-tu utiliser EasyJob ?', 'How do you want to use EasyJob?', 'كيف تريد استخدام EasyJob؟')}</p>

      <div className="mt-8 grid gap-4">
        <Link href="/register?intent=candidate" className="group">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
                <User className="size-6 text-primary" />
              </div>
              <CardTitle className="text-center">{tr('Je cherche un emploi', "I'm looking for a job", 'أبحث عن عمل')}</CardTitle>
              <CardDescription className="text-center">
                {tr('Construis ton profil, importe ton CV et postule gratuitement.', 'Build your profile, upload your CV, and apply to jobs for free.', 'أنشئ ملفك وارفع سيرتك وتقدم إلى الوظائف مجاناً.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center pb-5 text-sm font-medium text-primary">
              {tr('Continuer comme candidat', 'Continue as candidate', 'المتابعة كمترشح')} <ArrowRight className="ml-1 size-4 group-hover:translate-x-0.5 transition-transform" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/company/register" className="group">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Briefcase className="size-6 text-primary" />
              </div>
              <CardTitle className="text-center">{tr('Je recrute', "I'm hiring", 'أوظّف')}</CardTitle>
              <CardDescription className="text-center">
                {tr('Connecte-toi avec les identifiants fournis par ton administrateur EasyJob.', 'Sign in with the credentials provided by your EasyJob administrator.', 'سجّل الدخول بالبيانات التي قدمها مسؤول EasyJob.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center pb-5 text-sm font-medium text-primary">
              {tr('Continuer comme entreprise', 'Continue as a company', 'المتابعة كشركة')} <ArrowRight className="ml-1 size-4 group-hover:translate-x-0.5 transition-transform" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
