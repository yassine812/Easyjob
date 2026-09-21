'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CalendarClock, Pencil, X } from 'lucide-react';
import { interviewsApi } from '@/lib/api/interviews';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { INTERVIEW_TYPE_LABELS } from '@/lib/constants';
import type { Application, Interview } from '@/types/api';

const schema = z
  .object({
    applicationId: z.string().min(1, 'Select a candidate application'),
  type: z.enum(['PHONE', 'VIDEO', 'ONSITE', 'TECHNICAL', 'HR', 'BEHAVIORAL', 'MANAGERIAL', 'AI', 'FINAL']),
    startAt: z.string().min(1, 'Start time is required'),
    endAt: z.string().min(1, 'End time is required'),
    location: z.string().max(500).optional().or(z.literal('')),
    notes: z.string().max(2000).optional().or(z.literal('')),
  })
  .refine((v) => !v.startAt || !v.endAt || new Date(v.endAt) > new Date(v.startAt), {
    path: ['endAt'],
    message: 'End time must be after start time',
  });

type FormValues = z.infer<typeof schema>;

export function InterviewDialog({
  companyId,
  applications,
  applicationId,
  interview,
  onSaved,
}: {
  companyId: string;
  applications: Application[];
  applicationId?: string;
  interview?: Interview;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const isEdit = !!interview;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: interview
      ? {
          applicationId: interview.applicationId,
          type: interview.type,
          startAt: interview.startAt.slice(0, 16),
          endAt: interview.endAt.slice(0, 16),
          location: interview.location ?? '',
          notes: interview.notes ?? '',
        }
      : {
          applicationId: applicationId ?? '',
          type: 'VIDEO',
          startAt: '',
          endAt: '',
          location: '',
          notes: '',
        },
  });

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const payload = {
        applicationId: v.applicationId,
        type: v.type,
        startAt: new Date(v.startAt).toISOString(),
        endAt: new Date(v.endAt).toISOString(),
        location: v.location || undefined,
        notes: v.notes || undefined,
      };
      return isEdit
        ? interviewsApi.update(interview!.id, payload, companyId)
        : interviewsApi.create(payload, companyId);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Interview updated' : 'Interview scheduled — candidate notified');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['application-interviews'] });
      queryClient.invalidateQueries({ queryKey: ['company-applications', companyId] });
      onSaved?.();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save interview'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" aria-label="Edit interview">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm">
            <CalendarClock className="mr-1 size-4" /> Schedule interview
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit interview' : 'Schedule an interview'}</DialogTitle>
          <DialogDescription>
            The candidate is notified by email and in-app when the interview is scheduled.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="applicationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Candidate (application)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an application" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {applications.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.candidate?.user.name} — {a.job?.title}
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
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(INTERVIEW_TYPE_LABELS).map(([k, v]) => (
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
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="startAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location / meeting link</FormLabel>
                  <FormControl>
                    <Input placeholder="https://meet.example.com/xyz or office address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea className="min-h-20" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Schedule'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function CancelInterviewButton({
  interviewId,
  companyId,
}: {
  interviewId: string;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const cancel = useMutation({
    mutationFn: () => interviewsApi.update(interviewId, { status: 'CANCELLED' }, companyId),
    onSuccess: () => {
      toast.success('Interview cancelled');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['application-interviews'] });
      queryClient.invalidateQueries({ queryKey: ['company-applications', companyId] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not cancel'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Cancel interview" className="text-destructive hover:text-destructive">
          <X className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this interview?</DialogTitle>
          <DialogDescription>The candidate will be notified.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending}
          >
            Cancel interview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
