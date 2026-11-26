'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';

import Link from 'next/link';
import { HumanCoach } from '@/components/ui/human-coach';
import { Logo } from '@/components/layout/logo';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ArrowRight, Check, FileText, ScanText, Target, Send, MessageCircle, Search, MapPin, Building2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputWithIcon } from '@/components/ui/input-with-icon';
import { useProductText } from '@/lib/i18n/product';
import { useI18n } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';
import { billingApi } from '@/lib/api/billing';
import { useAuthStore } from '@/store/auth-store';
import { SkeletonRows } from '@/components/shared';
import { Failure } from '@/components/candidate/career-shared';
import { useCareerText } from '@/lib/i18n/career';
import type { Plan } from '@/types/api';

export function ProductPlans() {
  const t = useProductText(), tx = useCareerText(), { locale } = useI18n();
  const identity = useAuthStore(s => s.status + ':' + s.sessionRevision);
  const plans = useQuery({ queryKey: ['candidate-plans', identity], queryFn: () => billingApi.plans('CANDIDATE') });
  const rows = [
    ['job_search', 'planFeatureJobSearch'], ['tracking', 'planFeatureTracking'], ['cv_limit', 'planFeatureCvs'],
    ['basic_ats', 'planFeatureBasicAts'], ['advanced_ats', 'planFeatureAdvancedAts'], ['cv_tailoring', 'planFeatureTailoring'],
    ['detailed_matching', 'planFeatureMatching'], ['interview_preparation', 'planFeatureInterview'], ['advanced_analytics', 'planFeatureAnalytics'],
    ['email_alerts', 'planFeatureAlerts'], ['auto_apply', 'planFeatureAutoApply'], ['coding_interview', 'planFeatureCoding'], ['adaptive_interview', 'planFeatureAdaptive'],
  ] as const;
  const label = (plan: Plan) => plan.displayName ?? ({ FREE: 'EasyJob Start', PRO: 'EasyJob Boost', PREMIUM: 'EasyJob Max', CAREER_AI: 'EasyJob Max' } as Record<string, string>)[plan.name] ?? plan.name;
  return <section id="pricing" data-motion-item className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><div className="mb-10 max-w-2xl"><p className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">EasyJob · {t('subscription')}</p><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('plans')}</h2><p className="mt-4 text-muted-foreground">{t('plansBody')}</p></div>{plans.isPending ? <SkeletonRows rows={3} cols={3} /> : plans.isError ? <Failure retry={() => plans.refetch()} /> : <div className="grid gap-5 md:grid-cols-3">{plans.data.map(plan => { const premium = plan.features.auto_apply === true; const popular = plan.name === 'PRO'; return <article key={plan.id} className={`relative flex flex-col rounded-3xl border p-7 ${premium ? 'border-indigo-300 bg-indigo-50/60 dark:border-indigo-700 dark:bg-indigo-950/30' : 'border-border bg-card'}`}>{(popular || premium) && <span className="absolute -top-3 start-6 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">{popular ? t('mostPopular') : t('maximumAi')}</span>}<h3 className="text-lg font-semibold">{label(plan)}</h3><p className="my-6 text-3xl font-semibold tracking-tight">{formatMoney(plan.priceCents, plan.currency, locale)}<span className="ms-1 text-sm font-normal text-muted-foreground">/ {t(plan.billingInterval)}</span></p><ul className="mb-8 space-y-3 text-sm">{rows.filter(([feature]) => { const value = feature === 'cv_limit' ? plan.features.cv_limit ?? plan.features['cv.uploads'] : feature === 'job_search' || feature === 'tracking' ? plan.features[feature] !== false : plan.features[feature]; return typeof value === 'number' ? value > 0 : value === true; }).map(([feature, key]) => { const value = feature === 'cv_limit' ? plan.features.cv_limit ?? plan.features['cv.uploads'] : null; return <li key={feature} className="flex gap-2"><Check className="size-4 shrink-0 text-indigo-600 dark:text-indigo-300" />{tx(key)}{typeof value === 'number' ? ` · ${value}` : ''}</li>; })}</ul><Button variant={premium ? 'default' : 'outline'} asChild className="mt-auto w-full"><Link href="/candidate/subscription">{t('choosePlan')}<ArrowUpRight className="ms-2 size-4" /></Link></Button></article>; })}</div>}</section>;
}
export function CareerLanding() {
  const t = useProductText(), router = useRouter();
  const [keyword, setKeyword] = useState(''), [location, setLocation] = useState('');
  const steps = [FileText, ScanText, Target, Send, MessageCircle];
  return <div className="motion-landing career-canvas overflow-hidden bg-transparent text-foreground">
    <section className="motion-hero relative mx-auto grid max-w-7xl items-center px-5 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <p className="motion-eyebrow motion-enter mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium"><EasyJobFeatureMark size="sm" />{t('eyebrow')}</p>
        <h1>{t('hero')}<span>{t('heroAccent')}</span></h1>
        <p className="motion-hero-copy motion-enter mt-6 text-muted-foreground" style={{ animationDelay: '260ms' }}>{t('heroBody')}</p>
        <div className="motion-enter mt-7 flex flex-wrap items-center gap-3" style={{ animationDelay: '340ms' }}>
          <Button asChild size="lg" className="px-7"><Link href="/register">{t('start')}<ArrowUpRight className="ms-2 size-4" /></Link></Button>
          <Button size="lg" variant="ghost" asChild><a href="#how-it-works">{t('how')}</a></Button>
        </div>
        <p className="motion-enter mt-4 flex items-center gap-2 text-xs text-muted-foreground" style={{ animationDelay: '400ms' }}><ShieldCheck className="size-4" />{t('noCard')}</p>
      </div>
      <div className="journey-showcase">
        <div className="journey-caption"><div><h2>{t('journey')}</h2><p>{t('journeyBody')}</p></div><span className="journey-index" aria-hidden="true">01 — 05</span></div>
        <svg className="journey-route" viewBox="0 0 480 330" aria-hidden="true"><path d="M-20 180C65 180 20 35 125 70S430 60 400 170 290 270 520 235" /><circle cx="125" cy="70" r="4" /><circle cx="400" cy="170" r="4" /></svg>
        <HumanCoach className="journey-portrait" label="EasyJob AI" />
        <div className="journey-note journey-note--cv"><FileText aria-hidden="true" /><span>{t('step1')}</span></div>
        <div className="journey-note journey-note--interview"><MessageCircle aria-hidden="true" /><span>{t('step5')}</span></div>
        <ol className="journey-rail">{steps.map((Icon,i)=><li key={i} title={t(`step${i+1}`)}><Icon aria-hidden="true" /><span aria-hidden="true">0{i+1}</span><span className="sr-only">{t(`step${i+1}`)}</span></li>)}</ol>
      </div>
    </section>
    <section className="motion-search-strip"><form onSubmit={e => { e.preventDefault(); router.push(`/jobs?${new URLSearchParams({ keyword, location })}`); }} className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 sm:px-8 md:flex-row md:items-center"><h2 className="me-5 shrink-0 text-lg font-semibold">{t('find')}</h2><label className="min-w-0 flex-1"><InputWithIcon icon={<Search className="size-4" />} className="h-11 bg-background" aria-label={t('keyword')} placeholder={t('keyword')} value={keyword} onChange={e => setKeyword(e.target.value)} /></label><label className="min-w-0 flex-1"><InputWithIcon icon={<MapPin className="size-4" />} className="h-11 bg-background" aria-label={t('location')} placeholder={t('location')} value={location} onChange={e => setLocation(e.target.value)} /></label><Button type="submit" size="lg">{t('search')}<ArrowRight className="ms-2 size-4 rtl:rotate-180" /></Button></form></section>
    <section id="how-it-works" data-motion-item className="motion-workflow mx-auto max-w-7xl px-5 py-20 sm:px-8"><div className="mb-10 max-w-2xl"><p className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">{t('how')}</p><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('workflow')}</h2><p className="mt-4 text-muted-foreground">{t('workflowBody')}</p></div><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">{steps.map((Icon, i) => <article key={i} className="border-t-2 border-indigo-100 pt-6 dark:border-indigo-900"><Icon className="mb-4 size-6 text-indigo-500" /><h3 className="font-semibold">{t(`step${i + 1}`)}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{t(`step${i + 1}Body`)}</p></article>)}</div></section>
    <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-16 sm:px-8 md:grid-cols-2">{[[FileText, 'cv', 'builder'], [Target, 'match', 'recommended'], [Send, 'auto', 'auto'], [MessageCircle, 'coach', 'coach']].map(([Icon, key, label]) => { const FeatureIcon = Icon as typeof FileText; return <article id={String(key)} key={String(key)} data-motion-item className="motion-feature group rounded-3xl border bg-card p-7 transition-shadow hover:shadow-lg hover:shadow-indigo-900/5 sm:p-10"><div className="mb-6 flex items-center gap-3 text-indigo-600 dark:text-indigo-300"><FeatureIcon className="size-6" /><span className="text-sm font-medium">{t(String(label))}</span></div><h2 className="text-2xl font-semibold tracking-tight">{t(`${key}Feature`)}</h2><p className="mt-4 text-sm leading-7 text-muted-foreground">{t(`${key}Body`)}</p></article>; })}</section>
    <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-10 sm:px-8 md:grid-cols-2"><article className="rounded-3xl bg-indigo-600 p-8 text-white sm:p-10"><h2 className="text-3xl font-semibold tracking-tight">{t('candidatesTitle')}</h2><p className="my-5 text-sm leading-7 text-indigo-100">{t('candidatesBody')}</p><Button asChild variant="secondary"><Link href="/register">{t('start')}<ArrowUpRight className="ms-2 size-4" /></Link></Button></article><article id="companies" className="scroll-mt-24 rounded-3xl bg-slate-900 p-8 text-white sm:p-10"><Building2 className="mb-5 size-7 text-indigo-300" /><h2 className="text-3xl font-semibold tracking-tight">{t('companiesTitle')}</h2><p className="my-5 text-sm leading-7 text-slate-300">{t('companiesBody')}</p><Button asChild variant="secondary"><Link href="/register">{t('companiesCta')}<ArrowUpRight className="ms-2 size-4" /></Link></Button></article></section>
    <ProductPlans />
    <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8"><h2 className="mb-8 text-3xl font-semibold tracking-tight">{t('FAQ')}</h2>{['faqFree', 'faqFacts', 'faqScore', 'faqControl'].map(key => <details key={key} className="group border-b py-5"><summary className="cursor-pointer font-medium">{t(key)}</summary><p className="mt-4 text-sm leading-7 text-muted-foreground">{t(`${key}Answer`)}</p></details>)}</section>
    <section className="mx-auto max-w-4xl px-5 py-24 text-center sm:px-8"><EasyJobFeatureMark size="lg" className="mx-auto mb-5  text-indigo-500" /><h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">{t('finalTitle')}</h2><p className="my-6 text-muted-foreground">{t('finalBody')}</p><Button asChild size="lg" className="rounded-full px-8"><Link href="/register">{t('start')}<ArrowUpRight className="ms-2 size-4" /></Link></Button></section>
    <footer className="motion-footer border-t"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-8 text-sm sm:px-8"><Logo href="/" size="sm" /><nav className="flex flex-wrap gap-6 text-muted-foreground">{['privacy', 'terms', 'contact'].map(key => <Link key={key} href={`/${key}`} className="hover:text-foreground">{t(key)}</Link>)}</nav></div></footer>
  </div>;
}
