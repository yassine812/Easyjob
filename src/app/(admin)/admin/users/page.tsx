import { redirect } from 'next/navigation';

export default function LegacyAdminUsersPage() {
  redirect('/platform-admin/users');
}
