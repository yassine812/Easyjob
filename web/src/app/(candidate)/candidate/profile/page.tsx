'use client';
import { ProfilePhoto } from '@/components/candidate/profile-photo';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { candidatesApi } from '@/lib/api/candidates';
import { ApiError } from '@/lib/api/client';
import { PageHeader, ErrorState, SkeletonRows } from '@/components/shared';
import { SkillsSection } from '@/components/candidate/skills-section';
import { ExperienceSection } from '@/components/candidate/experience-section';
import { EducationSection } from '@/components/candidate/education-section';
import { CvUpload } from '@/components/candidate/career-shared';
import { ProfessionalDetails } from '@/components/candidate/career-pages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/constants';
import { useEntitlement } from '@/hooks/use-entitlement';
import { useCareerText } from '@/lib/i18n/career';

const profileSchema = z.object({
  headline: z.string().max(120).optional().or(z.literal('')),
  bio: z.string().max(2000).optional().or(z.literal('')),
  location: z.string().max(120).optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  yearsExperience: z.coerce.number().min(0).max(60).optional().or(z.literal('')),
  visibility: z.enum(['PUBLIC', 'RECRUITERS_ONLY', 'PRIVATE']),
  remotePreference: z.boolean(),
  employmentTypePreference: z.string().optional().or(z.literal('none')),
});

type ProfileFormValues = {
  headline: string;
  bio: string;
  location: string;
  phone: string;
  yearsExperience: number | '';
  visibility: string;
  remotePreference: boolean;
  employmentTypePreference: string;
};

export default function CandidateProfilePage() {
  const queryClient = useQueryClient();
  const ent = useEntitlement('CANDIDATE');
  const t = useCareerText();
  const profile = useQuery({ queryKey: ['candidate-profile'], queryFn: () => candidatesApi.me() });

  // defaultValues keep the inputs controlled from first render; `values` then
  // syncs the server data once loaded (avoids uncontrolled→controlled warnings).
  const defaultValues: ProfileFormValues = {
    headline: '',
    bio: '',
    location: '',
    phone: '',
    yearsExperience: '',
    visibility: 'RECRUITERS_ONLY',
    remotePreference: false,
    employmentTypePreference: 'none',
  };

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema) as unknown as Resolver<ProfileFormValues>,
    defaultValues,
    resetOptions: { keepDirtyValues: true },
    values: profile.data
      ? {
          headline: profile.data.headline ?? '',
          bio: profile.data.bio ?? '',
          location: profile.data.location ?? '',
          phone: profile.data.phone ?? '',
          yearsExperience: profile.data.yearsExperience ?? '',
          visibility: profile.data.visibility,
          remotePreference: profile.data.remotePreference ?? false,
          employmentTypePreference: profile.data.employmentTypePreference ?? 'none',
        }
      : defaultValues,
  });

  const save = useMutation({
    mutationFn: (v: {
      headline?: string;
      bio?: string;
      location?: string;
      phone?: string;
      yearsExperience?: number | '';
      visibility: string;
      remotePreference: boolean;
      employmentTypePreference?: string;
    }) =>
      candidatesApi.updateMe({
        headline: v.headline || undefined,
        bio: v.bio || undefined,
        location: v.location || undefined,
        phone: v.phone || undefined,
        yearsExperience: typeof v.yearsExperience === 'number' ? v.yearsExperience : undefined,
        visibility: v.visibility as never,
        remotePreference: v.remotePreference,
        employmentTypePreference:
          v.employmentTypePreference && v.employmentTypePreference !== 'none'
            ? (v.employmentTypePreference as never)
            : undefined,
      }),
    onSuccess: () => {
      toast.success('Profile saved');
      queryClient.invalidateQueries({ queryKey: ['candidate-profile'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save profile'),
  });

  if (profile.isPending) return <SkeletonRows rows={8} />;
  if (profile.isError) {
    return <ErrorState message="Could not load your profile." retry={() => profile.refetch()} />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My profile" description="Your public professional profile." />
      <div className="mt-8 space-y-6">
        {!ent.loading && ent.planName === 'FREE' && <Card className="border-indigo-200 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/25"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><div><CardTitle className="text-base">{t('upgradeProfileTitle')}</CardTitle><CardDescription className="mt-1">{t('upgradeProfileHelp')}</CardDescription></div><Button asChild><Link href="/candidate/subscription">{t('upgrade')}</Link></Button></CardContent></Card>}
        <CvUpload />
        <ProfilePhoto />
        <ProfessionalDetails />
        <Card>
          <CardHeader>
            <CardTitle>Basic information</CardTitle>
            <CardDescription>Your headline and summary — visible to recruiters.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="headline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Headline</FormLabel>
                      <FormControl>
                        <Input placeholder="Senior Product Engineer" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-28"
                          placeholder="A short summary of who you are and what you're looking for."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="Tunis, Tunisia" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+216 20 000 000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="yearsExperience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Years of experience</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={60} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Separator />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="visibility"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profile visibility</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PUBLIC">Public — any company can view</SelectItem>
                            <SelectItem value="RECRUITERS_ONLY">
                              Recruiters only — companies with an application from you
                            </SelectItem>
                            <SelectItem value="PRIVATE">Private — only after you apply</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Companies can only see your phone/email after you apply to them.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="employmentTypePreference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred employment type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No preference</SelectItem>
                            {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="remotePreference"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel className="font-medium">Open to remote work</FormLabel>
                        <FormDescription>Show this preference to recruiters.</FormDescription>
                      </div>
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="size-4"
                          aria-label="Open to remote work"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : 'Save profile'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <SkillsSection skills={profile.data.skills} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <ExperienceSection experiences={profile.data.experiences} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <EducationSection educations={profile.data.educations} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
