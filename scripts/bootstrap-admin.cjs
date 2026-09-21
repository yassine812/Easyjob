#!/usr/bin/env node
// Server operator command. No public endpoint can grant platform administration.
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const email = process.argv[2]?.trim().toLowerCase();
const bootstrapOwner = process.argv.includes('--bootstrap-owner');
(async () => {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Usage: npm run admin:grant -- verified-owner@domain.com');
  await db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') throw Error('An existing active account is required. No account changed.');
    if (!user.emailVerifiedAt && !bootstrapOwner) throw Error('Verify the account email first, or use --bootstrap-owner only for the server operator’s known owner account. No account changed.');
    const role = await tx.role.findUnique({ where: { name: 'PLATFORM_ADMIN' } });
    if (!role) throw Error('Run prisma:seed:system first.');
    const exists = await tx.userRole.findUnique({ where: { userId_roleId: { userId: user.id, roleId: role.id } } });
    if (exists) return;
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await tx.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
    await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({ data: { action: 'admin.bootstrap', entityType: 'User', entityId: user.id, metadata: { source: 'server-operator-cli', bootstrapOwner, emailVerified: !!user.emailVerifiedAt } } });
  });
  console.log('Platform administrator configured. Sign in again with the existing password.');
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
