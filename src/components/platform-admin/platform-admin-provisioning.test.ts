import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { platformAdminNav } from './platform-admin-shell';

const usersSource = readFileSync(resolve('src/components/platform-admin/users-center.tsx'), 'utf8');
const provisionSource = readFileSync(resolve('src/components/admin/provision-company.tsx'), 'utf8');
const serviceSource = readFileSync(resolve('backend/src/admin/company-provisioning.service.ts'), 'utf8');
const controllerSource = readFileSync(resolve('backend/src/admin/admin.controller.ts'), 'utf8');
const templateSource = readFileSync(resolve('backend/src/queues/email/templates.ts'), 'utf8');

describe('Platform Admin company provisioning workflow', () => {
  it('removes the obsolete verification navigation and API surface', () => {
    expect(platformAdminNav.some(item => item.label === 'Vérifications')).toBe(false);
    expect(usersSource).not.toContain('Vérifications');
    expect(controllerSource).not.toContain("@Get('verifications')");
    expect(controllerSource).not.toContain("@Post('verifications/:id/approve')");
  });

  it('exposes the four-step company creation flow from the companies tab', () => {
    expect(usersSource).toContain('<ProvisionCompany compact');
    expect(provisionSource).toContain("['Entreprise', 'Responsable', 'Plan', 'Confirmation']");
    expect(provisionSource).toContain('Créer et envoyer l’invitation');
    expect(provisionSource).toContain('timezone');
    expect(provisionSource).toContain('currency');
  });

  it('uses a one-time activation token and never sends a password', () => {
    expect(serviceSource).toContain('/activate-company-account?token=');
    expect(serviceSource).toContain('passwordResetToken.create');
    expect(serviceSource).toContain('companyInvitation.create');
    expect(serviceSource).toContain('hashToken(resetToken)');
    expect(serviceSource).not.toContain('password:');
    expect(templateSource).toContain('Activer mon compte');
    expect(templateSource).toContain('Plan :');
  });

  it('supports secure invitation resend and auditable provisioning events', () => {
    expect(serviceSource).toContain('invitation_resent');
    expect(serviceSource).toContain("action: 'company_created'");
    expect(serviceSource).toContain("action: 'owner_created'");
    expect(serviceSource).toContain("action: 'subscription_assigned'");
    expect(serviceSource).toContain("action: 'invitation_sent'");
    expect(readFileSync(resolve('backend/src/auth/auth.service.ts'), 'utf8')).toContain("'account_activated'");
    expect(controllerSource).toContain("companies/:id/invitation/resend");
  });
});
