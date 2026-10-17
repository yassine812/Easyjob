import { PlatformAdminShell } from '@/components/platform-admin/platform-admin-shell';

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return <PlatformAdminShell>{children}</PlatformAdminShell>;
}
