const labels: Record<string, string> = {
  ACTIVE: 'Actif', SUSPENDED: 'Suspendu', PENDING: 'En attente', PENDING_APPROVAL: 'En attente d’approbation',
  PENDING_VERIFICATION: 'Vérification en attente', UNDER_REVIEW: 'En cours d’examen', VERIFIED: 'Vérifiée',
  REJECTED: 'Refusé', APPROVED: 'Approuvée', PUBLISHED: 'Publiée', PAUSED: 'En pause', DRAFT: 'Brouillon',
  EXPIRED: 'Expirée', CLOSED: 'Fermée', TRIALING: 'Essai', PAST_DUE: 'Impayé', CANCELED: 'Annulé',
  SUCCEEDED: 'Réussi', PROCESSING: 'En traitement', COMPLETED: 'Terminé', FAILED: 'Échec', OPEN: 'Ouvert',
  IN_PROGRESS: 'En cours', WAITING_USER: 'En attente de l’utilisateur', RESOLVED: 'Résolu',
};

/**
 * Format values received from admin DTOs.  The API contract exposes enum
 * strings, but this boundary is deliberately defensive because old cached
 * responses and third-party adapters can still contain `{ value: ... }`.
 * Never call string methods on an unchecked runtime value.
 */
export function adminStatusLabel(value: unknown): string {
  const normalized = readEnumValue(value);
  if (!normalized) return '—';
  return labels[normalized] ?? normalized.replaceAll('_', ' ').toLowerCase();
}

export function adminCompanyStatusLabel(value: unknown): string { return adminStatusLabel(value); }
export function adminUserStatusLabel(value: unknown): string { return adminStatusLabel(value); }
export function adminSubscriptionStatusLabel(value: unknown): string { return adminStatusLabel(value); }
export function adminInvoiceStatusLabel(value: unknown): string { return adminStatusLabel(value); }

function readEnumValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const candidate = record.value ?? record.status ?? record.state ?? record.name;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

export const ADMIN_ROLE_LABELS: Record<string, string> = {
  COMPANY_ADMIN: 'Administrateur entreprise', HR: 'Ressources humaines', RECRUITER: 'Recruteur',
  HIRING_MANAGER: 'Responsable recrutement', INTERVIEWER: 'Intervieweur', CANDIDATE: 'Candidat',
  PLATFORM_ADMIN: 'Administrateur plateforme', SUPER_ADMIN: 'Super administrateur', OPERATIONS_ADMIN: 'Administrateur opérations',
  BILLING_ADMIN: 'Administrateur facturation', SUPPORT_ADMIN: 'Administrateur support', READ_ONLY_ADMIN: 'Administrateur lecture seule',
};
