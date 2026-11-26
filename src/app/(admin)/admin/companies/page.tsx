import { redirect } from 'next/navigation';

export default function LegacyAdminCompaniesPage() {
  redirect('/platform-admin/users?tab=companies');
}
