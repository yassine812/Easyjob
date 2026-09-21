'use client';

import { useState } from 'react';
import { useCareerText } from '@/lib/i18n/career';
import { useCompanyText } from '@/lib/i18n/company';
import { RecruitmentAssistant } from './recruitment-assistant';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { jobsApi } from '@/lib/api/jobs';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { EMPLOYMENT_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS, SKILL_LEVEL_LABELS } from '@/lib/constants';
import type { Job } from '@/types/api';

const skillSchema = z.object({
  name: z.string().min(1),
  required: z.boolean(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
});

const schema = (copy: (key: string) => string) => z.object({
  title: z.string().min(3, copy('titleValidation')).max(150),
  description: z.string().min(20, copy('descriptionValidation')).max(10000),
  responsibilities: z.array(z.object({ value: z.string() })),
  requirements: z.array(z.object({ value: z.string() })),
  location: z.string().max(120).optional().or(z.literal('')),
  remote: z.boolean(),
  contractType: z.enum(['', 'CDI', 'CDD']), languages: z.string().max(1000), domain: z.string().max(120), workMode: z.enum(['REMOTE', 'HYBRID', 'ONSITE']),
  educationRequirement: z.string().max(200), minimumYearsExperience: z.union([z.literal(''), z.coerce.number().int().min(0)]),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE']),
  experienceLevel: z.enum(['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE']),
  salaryMin: z.coerce.number().min(0).optional().or(z.literal('')),
  salaryMax: z.coerce.number().min(0).optional().or(z.literal('')),
  currency: z.string().max(3).optional().or(z.literal('')),
  expiresAt: z.string().optional().or(z.literal('')),
  skills: z.array(skillSchema),
});

type FormValues = {
  title: string;
  description: string;
  responsibilities: Array<{ value: string }>;
  requirements: Array<{ value: string }>;
  location: string;
  remote: boolean;
  contractType: '' | 'CDI' | 'CDD'; languages: string; domain: string; workMode: 'REMOTE' | 'HYBRID' | 'ONSITE'; educationRequirement: string; minimumYearsExperience: number | '';
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';
  experienceLevel: 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'EXECUTIVE';
  salaryMin: number | '';
  salaryMax: number | '';
  currency: string;
  expiresAt: string;
  skills: Array<{ name: string; required: boolean; level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' }>;
};

function listFieldDefaults(values: string[] | undefined): Array<{ value: string }> {
  return values && values.length > 0 ? values.map((v) => ({ value: v })) : [{ value: '' }];
}

export function JobForm({ companyId, job }: { companyId: string; job?: Job }) {
  const router = useRouter(), t = useCareerText();
  const copy = useCompanyText();
  const [details, setDetails] = useState({ department: job?.department ?? '', benefits: (job?.benefits ?? []).join('\n'), preferredEducation: job?.preferredEducation ?? '', preferredLanguages: (job?.preferredLanguages ?? []).join(', '), positions: job?.positions ?? 1, interviewProcess: job?.interviewProcess ?? '' });
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!job;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema(copy)) as unknown as Resolver<FormValues, unknown, FormValues>,
    defaultValues: job
      ? {
          title: job.title,
          description: job.description,
          responsibilities: listFieldDefaults(job.responsibilities),
          requirements: listFieldDefaults(job.requirements),
          location: job.location ?? '',
          contractType: (job.contractType || '') as '' | 'CDI' | 'CDD', languages: (job.languages || []).join(', '), remote: job.remote, domain: job.domain || '', workMode: job.workMode || (job.remote ? 'REMOTE' : 'ONSITE'),
          educationRequirement: job.educationRequirement || '', minimumYearsExperience: job.minimumYearsExperience ?? '',
          employmentType: job.employmentType,
          experienceLevel: job.experienceLevel,
          salaryMin: job.salaryMin ?? '',
          salaryMax: job.salaryMax ?? '',
          currency: job.currency ?? 'USD',
          expiresAt: job.expiresAt ? job.expiresAt.slice(0, 16) : '',
          skills: (job.skills ?? []).map((s) => ({
            name: s.skill.name,
            required: s.required,
            level: s.level,
          })),
        }
      : {
          title: '',
          description: '',
          responsibilities: [{ value: '' }],
          requirements: [{ value: '' }],
          location: '',
          contractType: '', languages: '', remote: false, domain: '', workMode: 'ONSITE', educationRequirement: '', minimumYearsExperience: '',
          employmentType: 'FULL_TIME',
          experienceLevel: 'MID',
          salaryMin: '',
          salaryMax: '',
          currency: 'USD',
          expiresAt: '',
          skills: [{ name: '', required: false, level: 'INTERMEDIATE' }],
        },
  });

  const respField = useFieldArray({ control: form.control, name: 'responsibilities' });
  const reqField = useFieldArray({ control: form.control, name: 'requirements' });
  const skillField = useFieldArray({ control: form.control, name: 'skills' });

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const payload = {
        ...details, benefits: details.benefits.split('\n').map(s => s.trim()).filter(Boolean), preferredLanguages: details.preferredLanguages.split(',').map(s => s.trim()).filter(Boolean),
        title: v.title,
        description: v.description,
        responsibilities: v.responsibilities.map((r) => r.value).filter(Boolean),
        requirements: v.requirements.map((r) => r.value).filter(Boolean),
        location: v.location || undefined,
        contractType: v.contractType, languages: v.languages.split(/[,،]/).map(s => s.trim()).filter(Boolean), remote: v.workMode === 'REMOTE', domain: v.domain, workMode: v.workMode, educationRequirement: v.educationRequirement,
        minimumYearsExperience: v.minimumYearsExperience === '' ? undefined : Number(v.minimumYearsExperience),
        employmentType: v.employmentType,
        experienceLevel: v.experienceLevel,
        salaryMin: v.salaryMin === '' ? undefined : Number(v.salaryMin),
        salaryMax: v.salaryMax === '' ? undefined : Number(v.salaryMax),
        currency: v.currency || undefined,
        expiresAt: v.expiresAt ? new Date(v.expiresAt).toISOString() : undefined,
        skills: v.skills.filter((s) => s.name.trim()).map((s) => ({ ...s, name: s.name.trim() })),
      };
      return isEdit
        ? jobsApi.update(job!.id, payload, companyId)
        : jobsApi.create(payload, companyId);
    },
    onSuccess: (saved) => {
      toast.success(copy('saved'));
      queryClient.invalidateQueries({ queryKey: ['company-jobs', companyId] });
      router.push(`/company/${companyId}/jobs/${saved.id}`);
    },
    onError: (err) => {
      const m = copy('saveError');
      setError(m);
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-8">
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <RecruitmentAssistant companyId={companyId} jobId={job?.id} defaultTask="job" initialInstruction={form.watch('title')} onApply={content => form.setValue('description', content, { shouldValidate: true })} />
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy('jobTitle')} *</FormLabel>
                <FormControl>
                  <Input placeholder={copy('jobTitle')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy('description')} *</FormLabel>
                <FormControl>
                  <Textarea className="min-h-32" placeholder={copy('description')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy('city')}</FormLabel>
                <FormControl>
                  <Input placeholder="Tunis" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="employmentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy('employmentType')} *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {t(k)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="experienceLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy('experience')} *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(EXPERIENCE_LEVEL_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {t(k)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField control={form.control} name="workMode" render={({ field }) => (
            <FormItem><FormLabel>{t('workMode')}</FormLabel><FormControl><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...field}>
              {['REMOTE', 'HYBRID', 'ONSITE'].map(mode => <option key={mode} value={mode}>{t(mode)}</option>)}
            </select></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField control={form.control} name="domain" render={({ field }) => <FormItem><FormLabel>{t('domain')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="contractType" render={({ field }) => <FormItem><FormLabel>{t('contractType')}</FormLabel><FormControl><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...field}><option value="">—</option>{['CDI', 'CDD'].map(k => <option key={k} value={k}>{t(k)}</option>)}</select></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="languages" render={({ field }) => <FormItem><FormLabel>{t('languages')}</FormLabel><FormControl><Input placeholder={t('comma')} {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="educationRequirement" render={({ field }) => <FormItem><FormLabel>{t('education')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="minimumYearsExperience" render={({ field }) => <FormItem><FormLabel>{t('yearsExperience')}</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="salaryMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy('salaryMin')}</FormLabel>
                <FormControl>
                  <Input type="number" min={0} placeholder="60000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="salaryMax"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy('salaryMax')}</FormLabel>
                <FormControl>
                  <Input type="number" min={0} placeholder="90000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy('currency')}</FormLabel>
                <FormControl>
                  <Input maxLength={3} placeholder="USD" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="expiresAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{copy('deadline')}</FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} />
              </FormControl>
              <FormDescription>
                Published jobs expire automatically after this date.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Responsibilities */}
        <div>
          <FormLabel>{copy('responsibilities')}</FormLabel>
          <div className="mt-2 space-y-2">
            {respField.fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <Input
                  placeholder={`${copy('responsibilities')} ${i + 1}`}
                  {...form.register(`responsibilities.${i}.value`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => respField.remove(i)}
                  aria-label={copy('remove')}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => respField.append({ value: '' })}
          >
            <Plus className="mr-1 size-3.5" /> {copy('add')}
          </Button>
        </div>

        {/* Requirements */}
        <div>
          <FormLabel>{copy('requirements')}</FormLabel>
          <div className="mt-2 space-y-2">
            {reqField.fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <Input
                  placeholder={`${copy('requirements')} ${i + 1}`}
                  {...form.register(`requirements.${i}.value`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => reqField.remove(i)}
                  aria-label={copy('remove')}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => reqField.append({ value: '' })}
          >
            <Plus className="mr-1 size-3.5" /> {copy('add')}
          </Button>
        </div>

        {/* Skills */}
        <div>
          <FormLabel>{copy('skills')}</FormLabel>
          <div className="mt-2 space-y-2">
            {skillField.fields.map((f, i) => (
              <div key={f.id} className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder={copy('skills')}
                  className="flex-1"
                  {...form.register(`skills.${i}.name`)}
                />
                <Select
                  value={form.watch(`skills.${i}.level`)}
                  onValueChange={(v) => form.setValue(`skills.${i}.level`, v as never)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SKILL_LEVEL_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {t(k)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={form.watch(`skills.${i}.required`)}
                    onCheckedChange={(v) => form.setValue(`skills.${i}.required`, v === true)}
                  />
                  {copy('required')}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => skillField.remove(i)}
                  aria-label={copy('remove')}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => skillField.append({ name: '', required: false, level: 'INTERMEDIATE' })}
          >
            <Plus className="mr-1 size-3.5" /> {copy('add')}
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {(['department', 'preferredEducation', 'preferredLanguages', 'interviewProcess', 'benefits'] as const).map(key => <label key={key} className="grid gap-2 text-sm">{copy(key)}<Textarea value={details[key]} onChange={e => setDetails(d => ({ ...d, [key]: e.target.value }))} maxLength={key === 'interviewProcess' ? 3000 : 1000} /></label>)}
          <label className="grid content-start gap-2 text-sm">{copy('numberOfPositions')}<Input type="number" min={1} max={10000} required value={details.positions} onChange={e => setDetails(d => ({ ...d, positions: Number(e.target.value) }))} /></label>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/company/${companyId}/jobs`)}
          >
            {copy('cancel')}
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {copy(save.isPending ? 'saving' : isEdit ? 'save' : 'postJob')}
          </Button>
        </div>
      </form>
    </Form>
  );
}

