import { redirect } from 'next/navigation';

/** Legacy account route: settings now live within the candidate profile. */
export default function SettingsPage() {
  redirect('/candidate/profile?settings=advanced');
}