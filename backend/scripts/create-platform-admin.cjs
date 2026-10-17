#!/usr/bin/env node
/*
 * One-time server-operator bootstrap.
 *
 * This command is intentionally outside the HTTP API. Public registration
 * cannot create a platform administrator, and this command refuses to create
 * a second one. Credentials are read from environment variables so they are
 * never written to shell history or printed in logs.
 */
require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();
const email = String(process.env.PLATFORM_ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.PLATFORM_ADMIN_PASSWORD || '');
const name = String(process.env.PLATFORM_ADMIN_NAME || 'Platform Administrator').trim();
const PLATFORM_ADMIN_ROLES = [
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'OPERATIONS_ADMIN',
  'BILLING_ADMIN',
  'SUPPORT_ADMIN',
  'READ_ONLY_ADMIN',
];

function fail(message) {
  throw new Error(message);
}

(async () => {
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    fail('Set PLATFORM_ADMIN_EMAIL to the email for the initial administrator.');
  }
  if (!password || password.length < 8 || password.length > 72 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    fail('Set PLATFORM_ADMIN_PASSWORD (8-72 chars, with lowercase, uppercase and a digit).');
  }
  if (!name || name.length > 120) fail('PLATFORM_ADMIN_NAME is required and must be at most 120 characters.');

  await db.$transaction(async (tx) => {
    const existingAdmin = await tx.user.findFirst({
      where: { roles: { some: { role: { name: { in: PLATFORM_ADMIN_ROLES } } } } },
      select: { email: true },
    });
    if (existingAdmin) {
      fail(`A platform administrator already exists (${existingAdmin.email}). No account changed.`);
    }

    const existingUser = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      fail('That email already belongs to an account. Use admin:grant only after confirming the account owner. No account changed.');
    }

    const role = await tx.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
    if (!role) fail('Run prisma:seed:system first so the platform roles exist.');

    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await tx.auditLog.create({
      data: {
        action: 'admin.bootstrap.created',
        entityType: 'User',
        entityId: user.id,
        metadata: { source: 'server-operator-cli', role: 'SUPER_ADMIN' },
      },
    });
  });

  console.log(`Initial platform administrator created for ${email}.`);
  console.log('The password was not logged. Store it in your password manager.');
})()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
