import { redirect } from 'next/navigation';

export default function LegacyCandidatesPage() {
  redirect('/platform-admin/users');
}
