import { redirect } from 'next/navigation';

/** Legacy compatibility URL: account management now starts at Candidats. */
export default function LegacyPlatformAdminUsersPage() {
  redirect('/platform-admin/candidates');
}
