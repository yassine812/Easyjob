'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { jobsApi } from '@/lib/api/jobs';
import { useCompanyText } from '@/lib/i18n/company';
import { LanguageToggle } from '@/lib/i18n';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { CompanyLogo } from '@/components/company/company-logo';
import { WorkspaceError, WorkspaceLoading } from '@/components/company/workspace-overview';
interface PublicCompany { id: string; commercialName: string; description: string | null; culture: string | null; benefits: string[]; country: string | null; city: string | null; industry: string | null; size: string | null; website: string | null; }
export default function PublicCompanyProfile() {
  const { slug } = useParams<{ slug: string }>(); const t = useCompanyText(); const [page, setPage] = useState(1);
  const company = useQuery({ queryKey: ['public-company-profile', slug], queryFn: () => api.get<PublicCompany>(`/companies/profile/${encodeURIComponent(slug)}`, { auth: false }) });
  const jobs = useQuery({ queryKey: ['public-company-jobs', slug, page], queryFn: () => jobsApi.search({ companySlug: slug, page, limit: 12 }), enabled: !!company.data });
  const data = company.data;
  return <main className="min-h-screen bg-muted/20 p-4 sm:p-8"><div className="mx-auto max-w-5xl space-y-7"><header className="flex items-center justify-between"><Link href="/" className="text-xl font-bold">EasyJob</Link><div className="flex gap-2"><LanguageToggle /><ThemeToggle /></div></header>{company.isError ? <WorkspaceError retry={() => void company.refetch()} /> : !data ? <WorkspaceLoading /> : <><section className="rounded-xl border bg-background p-6 sm:p-9"><CompanyLogo companyId={data.id} /><h1 className="my-4 text-3xl font-semibold">{data.commercialName}</h1><p className="text-sm text-muted-foreground">{[data.industry, data.city, data.country, data.size].filter(Boolean).join(' · ')}</p><p className="mt-6 whitespace-pre-wrap text-sm leading-7">{data.description}</p>{data.culture && <section className="mt-6"><h2 className="font-semibold">{t('culture')}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7">{data.culture}</p></section>}{data.benefits.length > 0 && <section className="mt-6"><h2 className="font-semibold">{t('benefitsTitle')}</h2><ul className="mt-3 list-disc space-y-2 ps-5 text-sm">{data.benefits.map((value, i) => <li key={i}>{value}</li>)}</ul></section>}{data.website && /^https?:\/\//i.test(data.website) && <a className="mt-6 inline-block text-sm text-primary" href={data.website} target="_blank" rel="noreferrer">{t('website')}</a>}</section><section><h2 className="mb-4 text-xl font-semibold">{t('activeJobs')}</h2>{jobs.isPending ? <WorkspaceLoading /> : jobs.isError ? <WorkspaceError retry={() => void jobs.refetch()} /> : <><div className="grid gap-4 sm:grid-cols-2">{jobs.data.items.map(job => <Link key={job.id} href={`/jobs/${job.id}`} className="rounded-lg border bg-background p-5 hover:border-primary/50"><h3 className="font-semibold">{job.title}</h3><p className="mt-3 text-sm text-muted-foreground">{job.location} · {t(job.employmentType)} · {t(job.experienceLevel)}</p></Link>)}</div>{!jobs.data.items.length && <p className="py-8 text-muted-foreground">{t('empty')}</p>}<div className="mt-5 flex justify-end gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('previous')}</Button><Button variant="outline" disabled={page * 12 >= jobs.data.total} onClick={() => setPage(p => p + 1)}>{t('next')}</Button></div></>}</section></>}</div></main>;
}
