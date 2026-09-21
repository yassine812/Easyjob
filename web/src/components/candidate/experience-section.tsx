'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Briefcase, Pencil, Plus, Trash2 } from 'lucide-react';
import { candidatesApi } from '@/lib/api/candidates';
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
import { formatDate } from '@/lib/format';
import { ApiError } from '@/lib/api/client';

const schema = z.object({
  companyName: z.string().min(1).max(120),
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional().or(z.literal('')),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional().or(z.literal('')),
  current: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function ExperienceSection({ experiences }: { experiences: Experience[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Experience | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: '',
      title: '',
      description: '',
      startDate: '',
      endDate: '',
      current: false,
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ companyName: '', title: '', description: '', startDate: '', endDate: '', current: false });
    setOpen(true);
  };

  const openEdit = (exp: Experience) => {
    setEditing(exp);
    form.reset({
      companyName: exp.companyName,
      title: exp.title,
      description: exp.description ?? '',
      startDate: exp.startDate.slice(0, 10),
      endDate: exp.endDate ? exp.endDate.slice(0, 10) : '',
      current: exp.current,
    });
    setOpen(true);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['candidate-profile'] });

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const payload = {
        companyName: v.companyName,
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
        <h2 className="font-semibold">Work experience</h2>
        <Button variant="outline" size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-3.5" /> Add experience
        </Button>
      </div>

      {experiences.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={Briefcase}
            title="No experience added"
            description="Add your work history to make your profile more attractive to employers."
            className="py-8"
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {experiences.map((exp) => (
            <li key={exp.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{exp.title}</p>
                  <p className="text-sm text-muted-foreground">{exp.companyName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(exp.startDate)} — {exp.current ? 'Present' : formatDate(exp.endDate)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(exp)} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove.mutate(exp.id)}
                    aria-label="Delete"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              {exp.description ? <p className="mt-2 text-sm text-muted-foreground">{exp.description}</p> : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit experience' : 'Add experience'}</DialogTitle>
            <DialogDescription>Tell employers what you worked on and achieved.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job title</FormLabel>
                    <FormControl>
                      <Input placeholder="Senior Engineer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Inc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start date</FormLabel>
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
                      <FormLabel>End date</FormLabel>
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
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">I currently work here</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-24" {...field} />
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
                  {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add experience'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
