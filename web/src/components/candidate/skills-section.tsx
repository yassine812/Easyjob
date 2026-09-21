'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { candidatesApi } from '@/lib/api/candidates';
import type { CandidateSkill } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { SKILL_LEVEL_LABELS } from '@/lib/constants';
import { ApiError } from '@/lib/api/client';

const schema = z.object({
  name: z.string().min(1, 'Skill name is required').max(80),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
});

export function SkillsSection({ skills }: { skills: CandidateSkill[] }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', level: 'INTERMEDIATE' as const },
  });

  const addSkill = useMutation({
    mutationFn: (v: z.infer<typeof schema>) =>
      candidatesApi.addSkill({ name: v.name, level: v.level }),
    onSuccess: () => {
      toast.success('Skill added');
      form.reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['candidate-profile'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not add skill'),
  });

  const removeSkill = useMutation({
    mutationFn: (skillId: string) => candidatesApi.removeSkill(skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-profile'] });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Skills</h2>
        <Button variant="outline" size="sm" onClick={() => setShowForm((s) => !s)}>
          <Plus className="mr-1 size-3.5" /> Add skill
        </Button>
      </div>

      {showForm ? (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => addSkill.mutate(v))}
            className="mt-3 flex flex-col gap-2 sm:flex-row"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input placeholder="e.g. TypeScript" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(SKILL_LEVEL_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <Button type="submit" size="sm" disabled={addSkill.isPending}>
              Add
            </Button>
          </form>
        </Form>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills yet — add the ones you know.</p>
        ) : (
          skills.map((s) => (
            <Badge key={s.id} variant="secondary" className="gap-1.5 py-1 pr-1.5 pl-2.5">
              {s.name}
              <span className="text-[10px] text-muted-foreground">{SKILL_LEVEL_LABELS[s.level]}</span>
              <button
                onClick={() => removeSkill.mutate(s.id)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remove ${s.name}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
