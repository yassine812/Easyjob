'use client';
import Link from 'next/link';
import { Activity, ArrowRight, ArrowUpRight, Briefcase, CalendarDays, ChevronRight, ClipboardList, Clock3, Eye, Flag, Handshake, Layers3, Plus, TriangleAlert, Users, Zap } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import type { WorkspaceOverview } from '@/lib/api/company-workspace';
import { recruiterJobApplicationsRoute } from '@/lib/job-display';
import { useI18n } from '@/lib/i18n';
import { useCompanyText } from '@/lib/i18n/company';
import { useDashboardText } from '@/lib/i18n/recruiter-dashboard';
import { useRole } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';
import { AnimatedNumber, ApplicationsChart, Avatar, DashboardPanel, DashboardSkeleton, KpiCard, RelativeDate, Trend } from './dashboard-widgets';
import styles from './recruiter-dashboard.module.css';

const stages = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED'] as const;
const colors = ['#8073ff', '#6991ff', '#4bc4ee', '#42d7cc', '#efba63', '#45c68b'];
const quality = ['STRONG_MATCH', 'PROMISING', 'REVIEW', 'LOW_ALIGNMENT'] as const;
const qualityColors = ['#36bc99', '#4cb4e7', '#dfac55', '#e77e99'];
const qualityIcons = [Users, Activity, Clock3, TriangleAlert];
const accent = (color: string) => ({ '--accent': color } as CSSProperties);

export function RecruiterHome({ companyId, data, controls, error }: { companyId: string; data?: WorkspaceOverview; controls: ReactNode; loading?: ReactNode; error?: ReactNode }) {
  const t = useCompanyText(), copy = useDashboardText(), { locale } = useI18n(), { can } = useRole();
  const href = (path: string) => `/company/${encodeURIComponent(companyId)}/${path}`;
  const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  const header = <header className={styles.hero}><div className={styles.heroText}><p className={styles.eyebrow}>EasyJob · {copy('workspace')}</p><h1>{copy('title')}</h1><p className={styles.subtitle}>{copy('subtitle')}</p></div><div className={styles.heroActions}>{controls}{can(companyId, 'job.create') && <Button asChild className={styles.createButton}><Link href={href('jobs/new')}><Plus size={17} />{t('postJob')}</Link></Button>}</div></header>;
  if (!data) return <div className={styles.dashboard}>{header}{error ?? <DashboardSkeleton />}</div>;
  const intelligence = data.advancedAnalysisAvailable === true;
  const period = `&from=${encodeURIComponent(data.from)}&to=${encodeURIComponent(data.to)}&includeLowAlignment=true`;
  const pipelineTotal = stages.reduce((sum, stage) => sum + (data.stages[stage] ?? 0), 0);
  const overdue = data.attention?.overdue ?? 0;
  const tasks = [
    { label: t('newApplications'), value: data.attention?.newApplications ?? data.stages.APPLIED ?? 0, path: 'pipeline?status=APPLIED', icon: ClipboardList },
    { label: t('UNDER_REVIEW'), value: data.attention?.review ?? data.stages.UNDER_REVIEW ?? 0, path: 'pipeline?status=UNDER_REVIEW', icon: Eye },
    { label: t('interviewsToday'), value: data.attention?.interviewsToday ?? 0, path: 'interviews', icon: CalendarDays },
    { label: t('pendingOffers'), value: data.attention?.offers ?? 0, path: 'pipeline?status=OFFER', icon: Handshake },
  ];
  const maxDays = Math.max(1, ...(data.bottlenecks ?? []).map(item => item.averageDays ?? 0));
  const premiumTitle = (key: string) => <><EasyJobFeatureMark size="md" />{t(key)}</>;
  return <div className={styles.dashboard}>
    {header}{error}
    <section className={styles.kpis} aria-label={t('overview')}>
      <KpiCard label={t('activeJobs')} value={data.jobs.PUBLISHED ?? 0} href={href('jobs?status=PUBLISHED')} icon={Briefcase} color="#4faee7" caption={copy('now')} />
      <KpiCard label={copy('received')} value={data.totalApplications} href={href(`pipeline?sort=newest${period}`)} icon={ClipboardList} color="#35bba6" trend={data.comparison?.applicationsPercent} caption={copy('period')} />
      <KpiCard label={t('UNDER_REVIEW')} value={data.attention?.review ?? data.stages.UNDER_REVIEW ?? 0} href={href('pipeline?status=UNDER_REVIEW')} icon={Eye} color="#dcae62" caption={copy('live')} />
      <KpiCard label={t('upcoming')} value={data.upcomingCount ?? data.upcoming.length} href={href('interviews')} icon={CalendarDays} color="#a18afa" caption={copy('now')} />
    </section>
    <div className={styles.priorityGrid}>
      <DashboardPanel title={t('attentionToday')} icon={Zap} description={t('attentionHelpLive')} href={href('pipeline?includeLowAlignment=true')} action={copy('tasks')}><div className={styles.tasks}>{tasks.map(({ label, value, path, icon: Icon }, i) => <Link key={path} href={href(path)} className={styles.task} style={accent(colors[i])}><span className={styles.smallIcon}><Icon size={18} /></span><span><strong><AnimatedNumber value={value} /></strong><small>{label}</small></span><ChevronRight size={15} /></Link>)}</div></DashboardPanel>
      <aside className={styles.brand}><div><p className={styles.eyebrow}>EasyJob</p><h2>{copy('brand')}</h2><p>{copy('brandSub')}</p><span className={styles.brandRule} /></div><div className={styles.summit} aria-hidden="true"><div className={styles.planet} /><div className={styles.mountainBack} /><div className={styles.mountain} /><Flag className={styles.flag} /></div></aside>
    </div>
    <div className={styles.chartGrid}>
      <DashboardPanel title={t('applicationsOverTime')} icon={Activity} description={copy('activityHelp')}><div className={styles.chartStats}><strong>{number(data.totalApplications)}</strong><span>{t('applications')}</span><Trend value={data.comparison?.applicationsPercent} /></div><ApplicationsChart daily={data.daily} /></DashboardPanel>
      <DashboardPanel title={t('pipeline')} icon={Layers3} description={copy('pipelineHelp')} href={href('pipeline?includeLowAlignment=true')} action={copy('viewPipeline')}>
        <div className={styles.segmented} aria-hidden="true">{stages.map((stage, i) => <span key={stage} style={{ background: colors[i], width: `${pipelineTotal ? (data.stages[stage] ?? 0) / pipelineTotal * 100 : 0}%` }} />)}</div>
        <div className={styles.stageGrid}>{stages.map((stage, i) => <Link href={href(`pipeline?status=${stage}${period}`)} key={stage} className={styles.stage}><span><i style={{ background: colors[i] }} />{t(stage)}</span><strong>{number(data.stages[stage] ?? 0)}</strong><small>{pipelineTotal ? number((data.stages[stage] ?? 0) / pipelineTotal * 100) : 0}%</small></Link>)}</div>
        {(data.stages.APPLIED ?? 0) > 0 && <Link href={href('pipeline?status=APPLIED')} className={styles.textLink}>{t('reviewApplications')} {data.stages.APPLIED}<ArrowRight size={13} /></Link>}
      </DashboardPanel>
    </div>
    <div className={intelligence ? styles.triple : styles.single}>
      {intelligence && <DashboardPanel title={premiumTitle('applicationQuality')} description={copy('qualityHelp')}><div className={styles.quality}>{quality.map((category, i) => { const count = data.classificationDistribution?.[category] ?? 0; const Icon = qualityIcons[i]; return <Link key={category} href={href(`pipeline?classification=${category}&sort=match${period}`)} style={accent(qualityColors[i])}><span>{t(category)}</span><strong>{number(count)}</strong><div><small>{data.totalApplications ? number(count / data.totalApplications * 100) : 0}%</small><Icon size={18} /></div></Link>; })}</div></DashboardPanel>}
      {intelligence && <DashboardPanel title={premiumTitle('topReview')} href={href('pipeline?sort=match&activeOnly=true')} action={copy('viewAll')}><div className={styles.rows}>{data.topCandidates?.slice(0, 5).map(candidate => <Link key={candidate.id} href={href(`applications/${candidate.id}`)} className={styles.row}><Avatar name={candidate.candidateName} /><div className={styles.rowText}><strong>{candidate.candidateName}</strong><small title={candidate.jobTitle}>{candidate.jobTitle}</small><span className={styles.potential}><EasyJobFeatureMark />{copy('potential')} : {t(candidate.potentialAssessment.applicable ? candidate.potentialScore || 'UNDETERMINED' : 'NOT_APPLICABLE')}</span>{candidate.classification && <small>{t(candidate.classification)}</small>}</div><span className={styles.match} title={copy('match')}>{candidate.aiMatchScore == null ? '—' : `${candidate.aiMatchScore}%`}</span><ArrowUpRight size={14} /></Link>)}{!data.topCandidates?.length && <p className={styles.empty}>{copy('topEmpty')}</p>}</div></DashboardPanel>}
      <DashboardPanel title={t('mostActiveJobs')} icon={Briefcase} href={href('jobs')} action={copy('viewAll')}><div className={styles.rows}>{data.applicationsByJob.slice(0, 4).map(job => <Link href={recruiterJobApplicationsRoute(companyId, job.id)} key={job.id} className={styles.row}><span className={styles.jobIcon}><Briefcase size={17} /></span><span className={styles.rowText}><strong title={job.title}>{job.title}</strong><span className={styles.jobStats}><small>{job.total} {t('applications')}</small><small>{job.pending} {copy('pendingFiles')}</small><small>{job.interviews} {t('INTERVIEW').toLocaleLowerCase(locale)}</small></span></span><ChevronRight size={14} /></Link>)}{!data.applicationsByJob.length && <p className={styles.empty}>{copy('jobsEmpty')}</p>}</div></DashboardPanel>
    </div>
    <div className={styles.triple}>
      <DashboardPanel title={t('recent')} icon={ClipboardList} href={href('pipeline?sort=newest&includeLowAlignment=true')} action={copy('viewAll')}><div className={styles.rows}>{data.recent.slice(0, 4).map(app => <Link href={href(`applications/${app.id}`)} key={app.id} className={styles.row}><Avatar name={app.candidate.user.name} /><div className={styles.rowText}><strong>{app.candidate.user.name}</strong><small title={app.job.title}>{app.job.title}</small><span className={styles.rowMeta}><span className={styles.status}>{t(app.status)}</span>{app.appliedAt && <RelativeDate date={app.appliedAt} />}</span></div>{intelligence && app.aiMatchScore != null && <span className={styles.match} title={copy('match')}>{app.aiMatchScore}%</span>}<ChevronRight size={14} /></Link>)}{!data.recent.length && <p className={styles.empty}>{copy('recentEmpty')}</p>}</div></DashboardPanel>
      <DashboardPanel title={t('upcoming')} icon={CalendarDays} href={href('interviews?view=calendar')} action={copy('calendar')}><div className={styles.rows}>{data.upcoming.slice(0, 3).map(interview => <Link href={`/meetings/${encodeURIComponent(interview.id)}`} key={interview.id} className={styles.row}><time className={styles.dateTile} dateTime={interview.startAt}>{new Intl.DateTimeFormat(locale, { day: '2-digit', timeZone: interview.timezone }).format(new Date(interview.startAt))}<small>{new Intl.DateTimeFormat(locale, { month: 'short', timeZone: interview.timezone }).format(new Date(interview.startAt))}</small></time><div className={styles.rowText}><strong>{interview.application.candidate.user.name}</strong><small>{interview.application.job.title}</small><span className={styles.rowMeta}>{new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: interview.timezone }).format(new Date(interview.startAt))}{interview.meetingRoomId ? ' · EasyJob Meeting' : ''}{interview.timezone && <small>{interview.timezone}</small>}</span></div><ChevronRight size={14} /></Link>)}{!data.upcoming.length && <div className={styles.interviewEmpty}><CalendarDays size={25} /><p>{copy('interviewEmpty')}</p>{can(companyId, 'interview.create') && <Link className={styles.textLink} href={href('interviews?compose=1')}>{copy('schedule')}<ArrowRight size={13} /></Link>}</div>}</div></DashboardPanel>
      <DashboardPanel title={t('bottlenecks')} icon={Clock3} description={t('averageStageDays')}><div className={styles.bottlenecks}>{data.bottlenecks?.slice(0, 4).map(item => <Link href={href(`pipeline?status=${item.stage}&sort=stageTime`)} key={item.stage}><div><span>{t(item.stage)}</span><strong>{item.averageDays == null ? '—' : number(item.averageDays)} <small>{t('days')}</small></strong></div><span className={styles.meter}><i style={{ width: `${(item.averageDays ?? 0) / maxDays * 100}%` }} /></span><small>{item.completedIntervals} {copy('samples')}</small></Link>)}{!data.bottlenecks?.length && <p className={styles.empty}>{t('noStageHistory')}</p>}</div></DashboardPanel>
    </div>
    {(data.velocity?.some(item => item.averageDays != null) || !!data.funnel?.length) && <div className={styles.chartGrid}>
      {data.velocity?.some(item => item.averageDays != null) && <DashboardPanel title={copy('velocity')} icon={Zap} description={copy('velocityHelp')}><div className={styles.velocity}>{data.velocity.map(item => <div key={item.key}><span>{copy(item.key as 'applicationToInterview' | 'interviewToOffer' | 'offerToHire')}</span><strong>{item.averageDays == null ? '—' : number(item.averageDays)} <small>{t('days')}</small></strong><small>{item.sampleSize ? `${item.sampleSize} ${copy('samples')}` : copy('insufficient')}</small></div>)}</div></DashboardPanel>}
      {!!data.funnel?.length && <DashboardPanel title={copy('funnel')} icon={Layers3} description={copy('funnelHelp')}><ol className={styles.funnel}>{data.funnel.map((item, i) => <li key={item.stage}><span>{t(item.stage)}</span><span className={styles.funnelBar}><i style={{ width: `${data.totalApplications ? item.count / data.totalApplications * 100 : 0}%`, background: colors[i] }} /></span><strong>{item.count}</strong><small>{item.conversion == null ? '—' : `${item.conversion}%`}</small></li>)}</ol></DashboardPanel>}
    </div>}
    <footer className={styles.footer}><div className={styles.attention}><TriangleAlert size={17} /><strong>{copy('attention')}</strong>{overdue > 0 ? <Link href={href('pipeline?overdue=true&sort=stageTime')}>{overdue} · {copy('overdue')}<ArrowRight size={14} /></Link> : <span>{copy('clear')}</span>}</div><nav className={styles.quickActions} aria-label={copy('tasks')}><Link href={href('pipeline?includeLowAlignment=true')}>{t('applications')}<ArrowUpRight size={14} /></Link>{can(companyId, 'interview.create') && <Link href={href('interviews?compose=1')}>{copy('schedule')}<Plus size={14} /></Link>}<Link href={href('interviews?view=calendar')}>{copy('calendar')}<CalendarDays size={14} /></Link></nav></footer>
  </div>;
}
