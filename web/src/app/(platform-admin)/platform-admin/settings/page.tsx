'use client';
import { PageHeader } from '@/components/shared';
export default function PlatformAdminSettingsPage() {
  return <div className="mx-auto max-w-5xl"><PageHeader title="Paramètres plateforme" description="Les secrets restent dans la configuration serveur. Cette page expose uniquement les états contrôlés." /><div className="mt-8 rounded-xl border bg-card p-6 text-sm text-muted-foreground">Les réglages de branding, de devise, de langues et de feature flags seront ajoutés derrière FeatureFlagService. Aucun secret ou variable d’environnement n’est exposé ici.</div></div>;
}
