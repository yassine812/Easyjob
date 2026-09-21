'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { usersApi } from '@/lib/api/users';
import { authApi } from '@/lib/api/auth';
import { clearSessionAtomic } from '@/lib/auth-session';
import { useAuthStore } from '@/store/auth-store';
import { ApiError } from '@/lib/api/client';
import { RequireAuth } from '@/components/shared/guards';
import { PageHeader } from '@/components/shared';
import { AppShell } from '@/components/layout/app-shell';
import { FaceStatusCard } from '@/components/auth/face-status';
import { resolveAccountType } from '@/lib/permissions';
import { Settings, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const profileSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().max(30).optional().or(z.literal('')),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1).max(72),
    password: z
      .string()
      .min(8)
      .max(72)
      .regex(/[a-z]/)
      .regex(/[A-Z]/)
      .regex(/[0-9]/),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', phone: user?.phone ?? '' },
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', password: '', confirm: '' },
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const onProfile = async (values: { name: string; phone?: string }) => {
    setSavingProfile(true);
    try {
      const updated = await usersApi.updateMe({
        name: values.name,
        phone: values.phone || undefined,
      });
      setUser({ ...user!, name: updated.name, phone: updated.phone });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const onPassword = async (values: { currentPassword: string; password: string }) => {
    setSavingPassword(true);
    try {
      await authApi.changePassword(values.currentPassword, values.password);
      passwordForm.reset();
      toast.success('Password updated');
      clearSessionAtomic();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <RequireAuth>
      <AppShell
        nav={[
          { href: '/settings', label: 'Account settings', icon: Settings },
          { href: '/candidate/profile', label: 'My profile', icon: UserRound },
        ]}
      >
        <div className="mx-auto max-w-2xl">
          <PageHeader title="Account settings" description="Manage your personal information, password, and security." />
          <div className="mt-8 space-y-6">
            {resolveAccountType(user) === 'candidate' && <FaceStatusCard />}
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Your name and phone number.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfile)} className="space-y-4">
                    <FormField
                      control={profileForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
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
                    <Button type="submit" disabled={savingProfile}>
                      {savingProfile ? 'Saving…' : 'Save profile'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Change password</CardTitle>
                <CardDescription>Use a strong, unique password.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPassword)} className="space-y-4">
                    <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => <FormItem><FormLabel>Current password</FormLabel><FormControl><Input type="password" autoComplete="current-password" {...field} /></FormControl><FormMessage /></FormItem>} />
                    <FormField
                      control={passwordForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New password</FormLabel>
                          <FormControl>
                            <Input type="password" autoComplete="new-password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="confirm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm password</FormLabel>
                          <FormControl>
                            <Input type="password" autoComplete="new-password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={savingPassword}>
                      {savingPassword ? 'Saving…' : 'Update password'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Separator />
            <p className="text-xs text-muted-foreground">
              Signed in as {user?.email}. Your sessions stay active until you sign out; resetting
              your password signs out all devices.
            </p>
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
