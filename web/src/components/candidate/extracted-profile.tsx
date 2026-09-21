'use client';
import { BriefcaseBusiness, CalendarDays } from 'lucide-react';
import type { CvExperience, ProfileDetails } from '@/lib/api/career';
import { useCareerText } from '@/lib/i18n/career';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function experienceDrafts(profile: ProfileDetails): CvExperience[] {
  return profile.experiences ?? (profile.sections.experience?.length ? [{ title: '', company: '', period: '', description: profile.sections.experience }] : []);
}
export function serializeExperiences(entries: CvExperience[]): string {
  return entries.map(e => [`Poste: ${e.title}`, `Entreprise: ${e.company}`, `Période: ${e.period}`, ...e.description].join('\n')).join('\n\n');
}
function missions(lines: string[]) {
  const result: string[] = [];
  for (const raw of lines.flatMap(value => value.replace(/\\n/g, '\n').split('\n'))) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-•●▪*]\s*/.test(line) || !result.length) result.push(line.replace(/^[-•●▪*]\s*/, ''));
    else result[result.length - 1] += ` ${line}`;
  }
  return result;
}
const cleanLineBreaks = (value: string) => value.replace(/\\n/g, '\n');
export function ExtractedProfile({ profile }: { profile: ProfileDetails }) {
  const t = useCareerText();
  const entries = experienceDrafts(profile);
  const presentation = cleanLineBreaks(profile.summary || profile.sections.summary?.join('\n') || '').trim();
  const sections = Object.entries(profile.sections).filter(([key, values]) => key !== 'summary' && key !== 'experience' && key !== 'skills' && key !== 'education' && key !== 'languages' && key !== 'certifications' && values.length);
  const skills = profile.skills ?? profile.sections.skills ?? [];
  return <div className="my-6 min-w-0 space-y-8">
    {!!presentation && <section><h3 className="mb-3 font-semibold">{t('summary')}</h3><p className="whitespace-pre-line break-words text-sm leading-6 text-muted-foreground">{presentation}</p></section>}
    <section aria-label={t('experience')}>
      <div className="mb-4 flex items-center gap-2"><BriefcaseBusiness className="size-5 text-primary" aria-hidden="true" /><h3 className="font-semibold">{t('experience')}</h3><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{entries.length}</span></div>
      <p className="mb-4 text-sm text-muted-foreground">{t('experienceHelp')}</p>
      {entries.length ? <div className="space-y-4">{entries.map((entry, index) => <article key={index} aria-label={entry.title || t('experienceUnknown')} className="min-w-0 rounded-xl border bg-background p-5">
        <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row"><div className="min-w-0"><h4 className="break-words font-semibold">{entry.title || t('experienceUnknown')}</h4>{entry.company && <p className="mt-1 break-words text-sm text-muted-foreground">{entry.company}</p>}</div>{entry.period && <p className="flex min-w-0 shrink items-start gap-2 self-start whitespace-normal break-words rounded-md bg-muted px-3 py-1.5 text-xs sm:max-w-[45%]"><CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />{entry.period}</p>}</div>
        {!!entry.description.length && <ul className="mt-4 list-disc space-y-2 ps-5 text-sm leading-6 text-muted-foreground">{missions(entry.description).map((line, i) => <li className="break-words" key={i}>{line}</li>)}</ul>}
      </article>)}</div> : <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{t('experienceEmpty')}</p>}
    </section>
    {!!skills.length && <section><h3 className="mb-3 font-semibold">{t('skills')}</h3><div className="flex flex-wrap gap-2">{skills.map((skill, index) => <span key={index} className="max-w-full break-words rounded-md border bg-muted/40 px-3 py-1.5 text-sm">{skill}</span>)}</div></section>}
    {!!profile.educations?.length && <section><h3 className="mb-3 font-semibold">{t('education')}</h3><div className="grid min-w-0 gap-3 md:grid-cols-2">{profile.educations.map((entry, index) => <article key={index} className="min-w-0 rounded-lg border bg-muted/20 p-4"><p className="break-words font-medium">{[entry.degree, entry.field].filter(Boolean).join(' · ') || t('education')}</p><p className="mt-1 break-words text-sm text-muted-foreground">{entry.institution}</p>{entry.period && <p className="mt-1 break-words text-xs text-muted-foreground">{entry.period}</p>}</article>)}</div></section>}
    {!!profile.languages?.length && <section><h3 className="mb-3 font-semibold">{t('languages')}</h3><div className="flex min-w-0 flex-wrap gap-2">{profile.languages.map((entry, index) => <span key={index} className="max-w-full whitespace-normal break-words rounded-full border bg-muted/40 px-3 py-1.5 text-sm">{entry.name} · {entry.level}</span>)}</div></section>}
    {!!profile.certifications?.length && <section><h3 className="mb-3 font-semibold">{t('certifications')}</h3><div className="grid min-w-0 gap-2 md:grid-cols-2">{profile.certifications.map((entry, index) => <p key={index} className="min-w-0 whitespace-normal break-words rounded-lg border bg-muted/20 p-3 text-sm">{entry.name}</p>)}</div></section>}
    <div className="grid min-w-0 gap-6 md:grid-cols-2">{sections.map(([key, values]) => <section className="min-w-0" key={key}><h3 className="mb-3 font-semibold">{t(key)}</h3><p className="whitespace-pre-line break-words text-sm leading-6 text-muted-foreground">{values.join('\n')}</p></section>)}</div>
  </div>;
}

export function ExperienceDraftEditor({ entries, onChange }: { entries: CvExperience[]; onChange: (entries: CvExperience[]) => void }) {
  const t = useCareerText();
  const change = (index: number, patch: Partial<CvExperience>) => onChange(entries.map((entry, i) => i === index ? { ...entry, ...patch } : entry));
  return <section className="space-y-4"><h3 className="font-semibold">{t('experience')}</h3><p className="text-sm text-muted-foreground">{t('experienceHelp')}</p>
    {!entries.length && <p className="text-sm text-muted-foreground">{t('experienceEmpty')}</p>}
    {entries.map((entry, index) => <fieldset key={index} className="min-w-0 space-y-4 rounded-xl border p-4 sm:p-5"><legend className="px-2 text-sm font-semibold">{t('experience')} {index + 1}</legend>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2"><label className="min-w-0 space-y-2 text-sm font-medium">{t('experienceRole')}<Input className="min-w-0" value={entry.title} maxLength={300} onChange={e => change(index, { title: e.target.value })} /></label><label className="min-w-0 space-y-2 text-sm font-medium">{t('experienceCompany')}<Input className="min-w-0" value={entry.company} maxLength={400} onChange={e => change(index, { company: e.target.value })} /></label></div>
      <label className="block min-w-0 space-y-2 text-sm font-medium">{t('experiencePeriod')}<Input className="min-w-0" value={entry.period} maxLength={150} onChange={e => change(index, { period: e.target.value })} /></label>
      <div className="space-y-2 text-sm font-medium">
        <p>{t('experienceMissions')}</p>
        <div className="space-y-2">
          {(missions(entry.description).length ? missions(entry.description) : ['']).map((mission, missionIndex, values) => <div key={missionIndex} className="flex min-w-0 items-start gap-2">
            <span className="mt-2.5 shrink-0 text-primary" aria-hidden="true">•</span>
            <Textarea className="min-h-16 min-w-0 flex-1" value={mission} maxLength={10000} onChange={e => {
              const next = [...values];
              next[missionIndex] = e.target.value;
              change(index, { description: next });
            }} aria-label={`${t('experienceMissions')} ${missionIndex + 1}`} />
            <Button type="button" variant="ghost" className="shrink-0 px-2 text-destructive" aria-label="Remove mission" onClick={() => {
              const next = values.filter((_, i) => i !== missionIndex);
              change(index, { description: next });
            }}>×</Button>
          </div>)}
        </div>
        <Button type="button" variant="outline" className="mt-1" onClick={() => change(index, { description: [...missions(entry.description), ''] })}>+ <span className="sr-only">Add mission</span></Button>
      </div>
      <Button type="button" variant="ghost" className="text-destructive" onClick={() => onChange(entries.filter((_, i) => i !== index))}>{t('experienceRemove')}</Button>
    </fieldset>)}
    <Button type="button" variant="outline" onClick={() => onChange([...entries, { title: '', company: '', period: '', description: [] }])}>{t('experienceAdd')}</Button>
  </section>;
}
