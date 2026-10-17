'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Bot, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { automationApi } from '@/lib/api/automation';
import { useRole } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api/client';
import { RequireCompanyPermission } from '@/components/shared/guards';
import { PageHeader, EmptyState, ErrorState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { AUTOMATION_TRIGGER_LABELS, AUTOMATION_ACTION_LABELS } from './labels';
import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { useEntitlement } from '@/hooks/use-entitlement';

const schema = z.object({
  name: z.string().min(1).max(120),
  triggerType: z.enum([
    'CANDIDATE_APPLIED',
    'APPLICATION_STATUS_CHANGED',
    'CANDIDATE_MATCH_SCORE_UPDATED',
    'INTERVIEW_SCHEDULED',
    'JOB_EXPIRING',
  ]),
  actionType: z.enum(['send_notification', 'send_email', 'move_application']),
  actionStatus: z.string().optional(),
  conditionStatus: z.string().optional(),
});

export default function AutomationPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const queryClient = useQueryClient();
  const { can } = useRole();
  const ent = useEntitlement('COMPANY', companyId);
  const [open, setOpen] = useState(false);

  const rules = useQuery({
    queryKey: ['automation-rules', companyId],
    queryFn: () => automationApi.list(companyId),
    enabled: can(companyId, 'automation.manage'),
  });
  const executions = useQuery({
    queryKey: ['automation-executions', companyId, { page: 1 }],
    queryFn: () => automationApi.executions(companyId, { page: 1, limit: 20 }),
    enabled: can(companyId, 'automation.manage'),
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      triggerType: 'CANDIDATE_APPLIED',
      actionType: 'send_notification',
      actionStatus: '',
      conditionStatus: '',
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['automation-rules', companyId] });
    queryClient.invalidateQueries({ queryKey: ['automation-executions', companyId] });
  };

  const create = useMutation({
    mutationFn: (v: z.infer<typeof schema>) =>
      automationApi.create(companyId, {
        name: v.name,
        triggerType: v.triggerType,
        conditions:
          v.conditionStatus && v.conditionStatus !== 'any'
            ? [{ field: 'newStatus', op: 'eq' as const, value: v.conditionStatus }]
            : [],
        actions: [
          v.actionType === 'move_application'
            ? { type: 'move_application', config: { toStatus: v.actionStatus ?? 'SCREENING' } }
            : v.actionType === 'send_email'
              ? { type: 'send_email', config: { subject: `${v.name} triggered` } }
              : {
                  type: 'send_notification',
                  config: { role: 'HR', title: v.name, message: `${v.name} was triggered` },
                },
        ],
      }),
    onSuccess: () => {
      toast.success('Automation rule created');
      setOpen(false);
      form.reset();
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not create rule'),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      automationApi.update(companyId, id, { active }),
    onSuccess: () => {
      toast.success('Rule updated');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update rule'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => automationApi.remove(companyId, id),
    onSuccess: () => {
      toast.success('Rule deleted');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not delete rule'),
  });

  return (
    <RequireCompanyPermission companyId={companyId} permission="automation.manage">
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Automation" description="Automate repetitive recruitment actions.">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={ent.feature('automation.enabled') === false}>
                <Plus className="mr-1 size-4" /> New rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create automation rule</DialogTitle>
                <DialogDescription>
                  When the trigger fires, the action runs automatically.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rule name</FormLabel>
                        <FormControl>
                          <Input placeholder="Notify on new applications" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="triggerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trigger</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(AUTOMATION_TRIGGER_LABELS).map(([k, v]) => (
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
                  <FormField
                    control={form.control}
                    name="actionType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Action</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(AUTOMATION_ACTION_LABELS).map(([k, v]) => (
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
                  {form.watch('actionType') === 'move_application' ? (
                    <FormField
                      control={form.control}
                      name="actionStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Set status to</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(APPLICATION_STATUS_LABELS).map(([k, v]) => (
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
                  ) : null}
                  <DialogFooter>
                    <Button type="submit" disabled={create.isPending}>
                      {create.isPending ? 'Creating…' : 'Create rule'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </PageHeader>

        {ent.feature('automation.enabled') === false ? (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Automation is not enabled on your current plan. Upgrade to BUSINESS or higher to use
            automation.
          </div>
        ) : null}

        <div className="mt-8 space-y-8">
          <section>
            <h2 className="mb-4 text-lg font-semibold">Rules</h2>
            {rules.isError ? (
              <ErrorState message="Could not load rules." retry={() => rules.refetch()} />
            ) : rules.data && rules.data.length > 0 ? (
              <div className="space-y-3">
                {rules.data.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                      <div>
                        <p className="font-medium">{r.name}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          When{' '}
                          <Badge variant="secondary" className="mx-0.5">
                            {AUTOMATION_TRIGGER_LABELS[r.triggerType] ?? r.triggerType}
                          </Badge>
                          →{' '}
                          {r.actions.map((a, i) => (
                            <Badge key={i} variant="secondary" className="mx-0.5">
                              {AUTOMATION_ACTION_LABELS[a.type] ?? a.type}
                            </Badge>
                          ))}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={r.active ? 'success' : 'secondary'}>
                          {r.active ? 'Active' : 'Paused'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={r.active ? 'Pause rule' : 'Activate rule'}
                          onClick={() => toggle.mutate({ id: r.id, active: !r.active })}
                        >
                          {r.active ? <Pause className="size-4" /> : <Play className="size-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete rule"
                          onClick={() => remove.mutate(r.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Bot}
                title="No automation rules"
                description="Create a rule to notify your team when candidates apply, or move applications automatically."
              />
            )}
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold">Executions</h2>
            {executions.data && executions.data.items.length > 0 ? (
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Trigger</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Executed at</th>
                      <th className="px-4 py-2">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.data.items.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="px-4 py-2">
                          {AUTOMATION_TRIGGER_LABELS[e.triggerType] ?? e.triggerType}
                        </td>
                        <td className="px-4 py-2">
                          <Badge
                            variant={
                              e.status === 'COMPLETED'
                                ? 'success'
                                : e.status === 'FAILED'
                                  ? 'destructive'
                                  : 'warning'
                            }
                          >
                            {e.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {e.executedAt ? formatDateTime(e.executedAt) : '—'}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{e.error ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No executions yet.</p>
            )}
          </section>
        </div>
      </div>
    </RequireCompanyPermission>
  );
}
