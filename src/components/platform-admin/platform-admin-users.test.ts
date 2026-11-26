import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { platformAdminNav } from './platform-admin-shell';

const usersSource = readFileSync(resolve('src/components/platform-admin/users-center.tsx'), 'utf8');
const adminServiceSource = readFileSync(resolve('backend/src/admin/admin.service.ts'), 'utf8');

describe('Platform Admin account hierarchy', () => {
  it('has one Users sidebar item and no separate Candidates or Companies items', () => {
    expect(platformAdminNav.filter(item => item.label === 'Utilisateurs')).toHaveLength(1);
    expect(platformAdminNav.some(item => item.label === 'Candidats')).toBe(false);
    expect(platformAdminNav.some(item => item.label === 'Entreprises')).toBe(false);
  });

  it('exposes the French Candidates and Companies tabs in the users center', () => {
    expect(usersSource).toContain('Candidats');
    expect(usersSource).toContain('Entreprises');
    expect(usersSource).toContain('Gérez les comptes candidats et entreprises de la plateforme.');
  });

  it('keeps recruiters grouped under the company owner/member model', () => {
    expect(adminServiceSource).toContain("members: { where: { isOwner: true }");
    expect(adminServiceSource).toContain('companyMemberships: { none: {} }');
    expect(adminServiceSource).toContain("startsWith: 'recruiter-demo-'");
    expect(usersSource).toContain('/platform-admin/users/companies/');
    expect(usersSource).not.toContain('recruiter-demo-');
  });

  it('uses server-side plans, expiration filters, counts, and pagination', () => {
    expect(adminServiceSource).toContain('subscriptions: { some: subscriptionWhere }');
    expect(adminServiceSource).toContain('currentPeriodEnd: { gte: nowDate');
    expect(usersSource).toContain('company._count?.members');
    expect(usersSource).toContain('<PaginationControls');
    expect(usersSource).toContain('EasyJob Boost');
    expect(usersSource).toContain('EasyJob Business');
  });

  it('uses grouped premium rows instead of fragmented CRUD columns', () => {
    expect(usersSource).toContain('Renouvellement');
    expect(usersSource).toContain('<PlanSubscriptionMeta');
    expect(usersSource).toContain('<ActivityMeta');
    expect(usersSource).toContain('Plan & abonnement');
    expect(usersSource).not.toContain('min-w-[1040px]');
    expect(usersSource).not.toContain('min-w-[1120px]');
    expect(usersSource).not.toContain('max-h-[calc(100vh');
    expect(usersSource).not.toContain('overflow-auto');
  });

  it('keeps advanced filters server-side and exposes responsive mobile cards', () => {
    expect(adminServiceSource).toContain('registeredWithin');
    expect(adminServiceSource).toContain('activeWithin');
    expect(usersSource).toContain('<PopoverTitle>Filtres</PopoverTitle>');
    expect(usersSource).toContain('Réinitialiser');
    expect(usersSource).toContain('Appliquer');
    expect(usersSource).toContain('min-[1100px]:hidden');
    expect(usersSource).toContain('data-users-list');
    expect(usersSource).not.toContain('expirent sous 7 jours</span>');
  });
});
