'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { applicationsApi } from '@/lib/api/applications';
import { resumesApi } from '@/lib/api/resumes';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';

const schema = z.object({
  resumeId: z.string().optional(),
  motivation: z.string().max(4000, 'Motivation must be 4000 characters or fewer').optional(),
});

type FormValues = z.infer<typeof schema>;

export function ApplyDialog({
  jobId,
  jobTitle,
  alreadyApplied,
}: {
  jobId: string;
  jobTitle: string;
  alreadyApplied?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: resumes } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => resumesApi.list(),
    enabled: open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { resumeId: undefined, motivation: '' },
  });

  const apply = useMutation({
    mutationFn: (values: FormValues) =>
      applicationsApi.apply(jobId, {
        resumeId: values.resumeId || undefined,
        motivation: values.motivation || undefined,
      }),
    onSuccess: () => {
      toast.success('Application submitted');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      router.push('/candidate/applications');
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : 'Could not submit application';
      toast.error(message);
      if (err instanceof ApiError && err.status === 403) {
        router.push('/verify-email');
      }
    },
  });

  if (alreadyApplied) {
    return (
      <Button disabled>
        Applied
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">Apply for this job</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply to {jobTitle}</DialogTitle>
          <DialogDescription>
            Attach a CV and add a short motivation. You can apply with any uploaded CV — even while
            it is still being processed.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => apply.mutate(v))} className="space-y-5">
            <FormField
              control={form.control}
              name="resumeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CV (optional)</FormLabel>
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a CV" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {resumes?.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.filename} {r.isPrimary ? '(primary)' : ''}
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
              name="motivation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivation (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Why are you a great fit for this role?"
                      className="min-h-28"
                      maxLength={4000}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={apply.isPending}>
                {apply.isPending ? 'Submitting…' : 'Submit application'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
