'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Briefcase, CalendarDays, ChevronDown, ChevronUp, Loader2, MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { candidatesApi } from '@/lib/api/candidates';
import type { CompanyDirectoryResult } from '@/lib/api/candidates';
import type { Experience } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { EmptyState } from '@/components/shared';
import { ApiError } from '@/lib/api/client';
import { initials } from '@/lib/format';
import { useCareerText } from '@/lib/i18n/career';
import { useI18n } from '@/lib/i18n';
import { env } from '@/config/env';

const schema = z.object({
  companyName: z.string().min(1).max(120),
  companyId: z.string().optional(),
  companyLogoUrl: z.string().optional(),
  companyWebsite: z.string().optional(),
  companyProvider: z.string().optional(),
  location: z.string().max(160).optional().or(z.literal('')),
  countryCode: z.string().max(8).optional().or(z.literal('')),
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional().or(z.literal('')),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional().or(z.literal('')),
  current: z.boolean(),
}).superRefine((value, ctx) => {
  if (!value.current && value.endDate && value.startDate && value.endDate < value.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End date must be after the start date' });
  }
});

type FormValues = z.infer<typeof schema>;

export function ExperienceSection({ experiences }: { experiences: Experience[] }) {
  const t = useCareerText();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Experience | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedCompany, setSelectedCompany] = useState<CompanyDirectoryResult | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: '',
      companyId: '', companyLogoUrl: '', companyWebsite: '', companyProvider: '', location: '', countryCode: '',
      title: '',
      description: '',
      startDate: '',
      endDate: '',
      current: false,
    },
  });

  const openCreate = () => {
    setEditing(null);
    setSelectedCompany(null);
    form.reset({ companyName: '', companyId: '', companyLogoUrl: '', companyWebsite: '', companyProvider: '', location: '', countryCode: '', title: '', description: '', startDate: '', endDate: '', current: false });
    setOpen(true);
  };

  const openEdit = (exp: Experience) => {
    setEditing(exp);
    form.reset({
      companyName: exp.companyName,
      companyId: exp.companyId ?? '', companyLogoUrl: exp.companyLogoUrl ?? '', companyWebsite: exp.companyWebsite ?? '', companyProvider: exp.companyProvider ?? '', location: exp.location ?? '', countryCode: exp.countryCode ?? '',
      title: exp.title,
      description: exp.description ?? '',
      startDate: exp.startDate.slice(0, 10),
      endDate: exp.endDate ? exp.endDate.slice(0, 10) : '',
      current: exp.current,
    });
    setSelectedCompany(exp.companyId ? { id: exp.companyId, name: exp.companyName, legalName: exp.companyName, website: exp.companyWebsite ?? null, logoUrl: resolveCompanyLogoUrl(exp.companyLogoUrl), location: exp.location ?? null, provider: exp.companyProvider ?? 'easyjob_directory' } : null);
    setOpen(true);
  };

  const companyQuery = form.watch('companyName') ?? '';
  const countryCode = form.watch('countryCode') ?? '';
  const [companyOptions, setCompanyOptions] = useState<CompanyDirectoryResult[]>([]);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companySearchComplete, setCompanySearchComplete] = useState(false);
  const [companyError, setCompanyError] = useState(false);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [activeCompanyIndex, setActiveCompanyIndex] = useState(-1);
  const companyInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const query = companyQuery.trim();
    if (selectedCompany || query.length < 2 || !open) {
      setCompanyOptions([]);
      setCompanyLoading(false);
      setCompanySearchComplete(false);
      return;
    }
    const controller = new AbortController();
    // Keep the menu in a loading state during the debounce window. This
    // prevents the empty-state copy from flashing before the request starts.
    setCompanyLoading(true);
    setCompanySearchComplete(false);
    const timer = window.setTimeout(() => {
      setCompanyError(false);
      candidatesApi.searchCompanies(query, countryCode, controller.signal).then((response) => {
        if (!controller.signal.aborted) {
          setCompanyOptions(response.results);
          setCompanyMenuOpen(true);
          setActiveCompanyIndex(-1);
          setCompanySearchComplete(true);
        }
      }).catch((error) => {
        if (!controller.signal.aborted) { setCompanyOptions([]); setCompanyError(true); setCompanyMenuOpen(true); setCompanySearchComplete(true); console.error('Company search failed', error); }
      }).finally(() => { if (!controller.signal.aborted) setCompanyLoading(false); });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [companyQuery, countryCode, open, selectedCompany]);

  const clearCompanyMetadata = () => {
    setSelectedCompany(null);
    form.setValue('companyId', '');
    form.setValue('companyLogoUrl', '');
    form.setValue('companyWebsite', '');
    form.setValue('companyProvider', '');
  };

  const selectCompany = (company: CompanyDirectoryResult) => {
    setSelectedCompany(company);
    form.setValue('companyName', company.name, { shouldValidate: true });
    form.setValue('companyId', company.id);
    form.setValue('companyLogoUrl', company.logoUrl ?? '');
    form.setValue('companyWebsite', company.website ?? '');
    form.setValue('companyProvider', company.provider);
    if (company.countryCode) form.setValue('countryCode', company.countryCode);
    if (company.location) form.setValue('location', company.location);
    setCompanyMenuOpen(false);
    setCompanyOptions([]);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['candidate-profile'] });

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const payload = {
        companyName: v.companyName,
        companyId: v.companyId || undefined,
        companyLogoUrl: v.companyLogoUrl || undefined,
        companyWebsite: v.companyWebsite || undefined,
        companyProvider: v.companyProvider || undefined,
        location: v.location || undefined,
        countryCode: v.countryCode || undefined,
        title: v.title,
        description: v.description || undefined,
        startDate: v.startDate,
        endDate: v.current ? undefined : v.endDate || undefined,
        current: v.current,
      };
      return editing
        ? candidatesApi.updateExperience(editing.id, payload)
        : candidatesApi.addExperience(payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Experience updated' : 'Experience added');
      setOpen(false);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save experience'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => candidatesApi.deleteExperience(id),
    onSuccess: () => {
      toast.success('Experience removed');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not remove'),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t('workExperience')}</h2>
        <Button variant="outline" size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-3.5" /> {t('addExperience')}
        </Button>
      </div>

      {experiences.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={Briefcase}
            title={t('experienceEmpty')}
            description={t('experienceHelp')}
            className="py-8"
          />
        </div>
      ) : (
        <ul className="relative mt-5 space-y-5 before:absolute before:bottom-5 before:left-[11px] before:top-5 before:w-px before:bg-border">
          {experiences.map((exp) => (
            <ExperienceTimelineItem
              key={exp.id}
              experience={exp}
              locale={locale}
              expanded={Boolean(expanded[exp.id])}
              onToggle={() => setExpanded(current => ({ ...current, [exp.id]: !current[exp.id] }))}
              onEdit={() => openEdit(exp)}
              onDelete={() => remove.mutate(exp.id)}
              editLabel={t('experienceEdit')}
              deleteLabel={t('experienceDelete')}
              currentLabel={t('experienceCurrent')}
              presentLabel={t('experiencePresent')}
              seeMoreLabel={t('experienceSeeMore')}
              seeLessLabel={t('experienceSeeLess')}
            />
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) { setCompanyMenuOpen(false); setCompanyOptions([]); } }}>
        <DialogContent className="h-auto max-h-[88vh] w-[92vw] max-w-[960px] overflow-hidden rounded-2xl p-0 sm:max-w-[960px] lg:max-w-[960px]">
          <DialogHeader className="border-b px-6 py-5 sm:px-8">
            <DialogTitle>{editing ? t('experienceModalEditTitle') : t('experienceModalAddTitle')}</DialogTitle>
            <DialogDescription>{t('experienceModalHelp')}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="flex max-h-[calc(90vh-148px)] flex-col">
              <div className="grid gap-5 overflow-y-auto px-6 py-5 sm:grid-cols-2 sm:px-8">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('experienceJobTitle')}</FormLabel>
                    <FormControl>
                      <Input placeholder="Senior Engineer" autoComplete="organization-title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="countryCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('experienceCountry')}</FormLabel>
                  <FormControl>
                    <select {...field} aria-label={t('experienceCountry')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                      <option value="">{t('experienceSelectCountry')}</option>
                      <option value="TN">🇹🇳 Tunisia</option>
                      <option value="FR">🇫🇷 France</option>
                      <option value="DE">🇩🇪 Germany</option>
                      <option value="US">🇺🇸 United States</option>
                      <option value="GB">🇬🇧 United Kingdom</option>
                      <option value="CA">🇨🇦 Canada</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('experienceLocation')}</FormLabel>
                  <FormControl><Input placeholder="Tunis, Tunisia" autoComplete="address-level2" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem className="relative sm:col-span-2">
                    <FormLabel>{t('experienceCompanyName')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input
                          {...field}
                          ref={(node) => { field.ref(node); companyInputRef.current = node; }}
                          className="pl-11 pr-10"
                          placeholder={t('experienceCompanySearch')}
                          autoComplete="organization"
                          role="combobox"
                          aria-expanded={companyMenuOpen}
                          aria-controls="experience-company-options"
                          aria-autocomplete="list"
                          onFocus={() => { if (companyQuery.trim().length >= 2 && !selectedCompany) setCompanyMenuOpen(true); }}
                          onChange={(event) => { field.onChange(event); clearCompanyMetadata(); setCompanyMenuOpen(true); }}
                          onKeyDown={(event) => {
                            if (!companyMenuOpen || (!companyOptions.length && !companyLoading)) return;
                            if (event.key === 'ArrowDown') { event.preventDefault(); setActiveCompanyIndex((index) => Math.min(index + 1, companyOptions.length - 1)); }
                            if (event.key === 'ArrowUp') { event.preventDefault(); setActiveCompanyIndex((index) => Math.max(index - 1, 0)); }
                            if (event.key === 'Enter' && activeCompanyIndex >= 0) { event.preventDefault(); selectCompany(companyOptions[activeCompanyIndex]); }
                            if (event.key === 'Escape') setCompanyMenuOpen(false);
                          }}
                        />
                        {companyLoading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label={t('experienceSearchingCompanies')} />}
                      </div>
                    </FormControl>
                    {companyMenuOpen && !selectedCompany && companyQuery.trim().length >= 2 && (
                      <div id="experience-company-options" role="listbox" className="absolute inset-x-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border bg-popover p-1 shadow-xl">
                        {companyLoading && <p className="px-3 py-2 text-xs text-muted-foreground">{t('experienceSearchingCompanies')}</p>}
                        {!companyLoading && companyOptions.map((company, index) => (
                          <button key={company.id} type="button" role="option" aria-selected={index === activeCompanyIndex} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent" onMouseDown={(event) => event.preventDefault()} onClick={() => selectCompany(company)}>
                            <CompanyAvatar name={company.name} logoUrl={company.logoUrl} />
                            <span className="min-w-0"><span className="block truncate font-medium">{company.name}</span>{company.location && <span className="block truncate text-xs text-muted-foreground">{company.location}</span>}</span>
                          </button>
                        ))}
                        {companySearchComplete && !companyLoading && companyOptions.length === 0 && <>
                          <p className="px-3 py-2 text-xs text-muted-foreground">{companyError ? t('experienceCompanySearchError') : t('experienceNoCompanies')}</p>
                          <button type="button" role="option" className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent" onMouseDown={(event) => event.preventDefault()} onClick={() => { clearCompanyMetadata(); setCompanyMenuOpen(false); }}>+ {`Use “${companyQuery.trim()}”`}</button>
                        </>}
                      </div>
                    )}
                    {selectedCompany && <p className="mt-1 text-xs text-muted-foreground">{selectedCompany.provider === 'easyjob_directory' ? 'EasyJob directory' : selectedCompany.provider}</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('experienceStartDate')}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('experienceEndDate')}</FormLabel>
                      <FormControl>
                        <Input type="date" disabled={form.watch('current')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="current"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0 sm:col-span-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">{t('experienceCurrentRole')}</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('experienceDescription')}</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-36" maxLength={2000} placeholder={t('experienceDescriptionHelp')} {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">{t('experienceDescriptionHelp')}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t('experienceCancel')}
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? t('experienceSaving') : editing ? t('experienceSaveChanges') : t('experienceSaveAdd')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExperienceTimelineItem({ experience, locale, expanded, onToggle, onEdit, onDelete, editLabel, deleteLabel, currentLabel, presentLabel, seeMoreLabel, seeLessLabel }: {
  experience: Experience;
  locale: 'en' | 'fr' | 'ar';
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editLabel: string;
  deleteLabel: string;
  currentLabel: string;
  presentLabel: string;
  seeMoreLabel: string;
  seeLessLabel: string;
}) {
  const bullets = useMemo(() => splitExperienceDescription(experience.description), [experience.description]);
  const visibleBullets = expanded ? bullets : bullets.slice(0, 3);
  const { company, location: legacyLocation } = splitCompanyLocation(experience.companyName);
  const location = experience.location || legacyLocation;
  const dates = `${formatExperienceMonth(experience.startDate, locale)} — ${experience.current ? presentLabel : formatExperienceMonth(experience.endDate, locale)}`;

  return <li className="relative pl-8">
    <span aria-hidden="true" className="absolute left-1.5 top-5 z-10 size-2.5 rounded-full border-2 border-card bg-primary ring-4 ring-background" />
    <article className="rounded-2xl border border-border/80 bg-card/60 p-5 transition-colors hover:border-primary/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-semibold tracking-tight">{experience.title}</h3>
            {experience.current && <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">{currentLabel}</span>}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {experience.companyLogoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={resolveCompanyLogoUrl(experience.companyLogoUrl) ?? undefined} alt="" className="size-5 rounded object-contain" /> : <span className="grid size-5 place-items-center rounded bg-muted text-[9px] font-semibold text-muted-foreground">{initials(company).slice(0, 2)}</span>}
            <p className="break-words text-sm font-medium text-muted-foreground">{company}</p>
          </div>
          {location && <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{location}</p>}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5 shrink-0" aria-hidden="true" /><time dateTime={experience.startDate}>{dates}</time></p>
        </div>
        <div className="flex shrink-0 gap-1 self-end sm:self-start">
          <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={onEdit} aria-label={editLabel} title={editLabel}><Pencil className="size-3.5" /></Button>
          <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={onDelete} aria-label={deleteLabel} title={deleteLabel}><Trash2 className="size-3.5" /></Button>
        </div>
      </div>
      {bullets.length > 0 && <>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">{visibleBullets.map((bullet, index) => <li key={`${experience.id}-${index}`} className="relative pl-4"><span aria-hidden="true" className="absolute left-0 top-[0.7em] size-1.5 rounded-full bg-muted-foreground/70" />{bullet}</li>)}</ul>
        {bullets.length > 3 && <button type="button" onClick={onToggle} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" aria-expanded={expanded}>{expanded ? <>{seeLessLabel}<ChevronUp className="size-3.5" /></> : <>{seeMoreLabel}<ChevronDown className="size-3.5" /></>}</button>}
      </>}
    </article>
  </li>;
}

function splitExperienceDescription(description: string | null): string[] {
  if (!description?.trim()) return [];
  return description.replace(/\r/g, '').split(/(?:^|\n|\s)[●•]\s*|\n+/).map(item => item.trim()).filter(Boolean);
}

function resolveCompanyLogoUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${env.apiUrl.replace(/\/$/, '')}/${value.replace(/^\//, '')}`;
}

function CompanyAvatar({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveCompanyLogoUrl(logoUrl);
  return <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted text-[10px] font-semibold text-muted-foreground">
    {resolved && !failed ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={resolved} alt="" className="size-full object-contain" onError={() => setFailed(true)} /> : initials(name).slice(0, 2)}
  </span>;
}


function splitCompanyLocation(value: string): { company: string; location: string | null } {
  const parts = value.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length < 2) return { company: value, location: null };
  return { company: parts[0], location: parts.slice(1).join(', ') };
}

function formatExperienceMonth(value: string | null, locale: 'en' | 'fr' | 'ar'): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : locale === 'ar' ? 'ar' : 'en-US', { year: 'numeric', month: 'short' }).format(new Date(value));
}
