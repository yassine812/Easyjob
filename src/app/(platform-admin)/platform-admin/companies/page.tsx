import { redirect } from 'next/navigation';

export default function LegacyCompaniesPage() {
  redirect('/platform-admin/users?tab=companies');
}
