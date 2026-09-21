'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import { candidatesApi } from '@/lib/api/candidates';
import type { Education } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  institution: z.string().min(1).max(160),
  degree: z.string().max(120).optional().or(z.literal('')),
  field: z.string().max(120).optional().or(z.literal('')),
  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function EducationSection({ educations }: { educations: Education[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Education | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { institution: '', degree: '', field: '', startDate: '', endDate: '' },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ institution: '', degree: '', field: '', startDate: '', endDate: '' });
    setOpen(true);
  };

  const openEdit = (edu: Education) => {
    setEditing(edu);
    form.reset({
      institution: edu.institution,
      degree: edu.degree ?? '',
      field: edu.field ?? '',
      startDate: edu.startDate ? edu.startDate.slice(0, 10) : '',
      endDate: edu.endDate ? edu.endDate.slice(0, 10) : '',
    });
    setOpen(true);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['candidate-profile'] });

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const payload = {
        institution: v.institution,
        degree: v.degree || undefined,
        field: v.field || undefined,
        startDate: v.startDate || undefined,
        endDate: v.endDate || undefined,
      };
      return editing
        ? candidatesApi.updateEducation(editing.id, payload)
        : candidatesApi.addEducation(payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Education updated' : 'Education added');
      setOpen(false);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save education'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => candidatesApi.deleteEducation(id),
    onSuccess: () => {
      toast.success('Education removed');
      invalidate();
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Education</h2>
        <Button variant="outline" size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-3.5" /> Add education
        </Button>
      </div>

      {educations.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={GraduationCap}
            title="No education added"
            description="Add your degrees, certifications or training."
            className="py-8"
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {educations.map((edu) => (
            <li key={edu.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{edu.institution}</p>
                  <p className="text-sm text-muted-foreground">
                    {[edu.degree, edu.field].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {edu.startDate ? formatDate(edu.startDate) : ''}
                    {edu.startDate && edu.endDate ? ' — ' : ''}
                    {edu.endDate ? formatDate(edu.endDate) : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(edu)} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove.mutate(edu.id)}
                    aria-label="Delete"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit education' : 'Add education'}</DialogTitle>
            <DialogDescription>Your studies, degree or training.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="institution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Institution</FormLabel>
                    <FormControl>
                      <Input placeholder="University of Tunis" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="degree"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Degree (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Bachelor's" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="field"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Field (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Computer Science" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start (optional)</FormLabel>
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
                      <FormLabel>End (optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add education'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
