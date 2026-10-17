const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createAndVerify() {
  const ts = Date.now();
  const candEmail = `cand_${ts}@example.com`;
  const compEmail = `comp_${ts}@example.com`;
  const password = 'Password123';

  console.log(`\n1. Registering Candidate: ${candEmail}`);
  const candRegRes = await fetch('http://localhost:3000/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Alice Candidate ${ts}`,
      email: candEmail,
      password,
      intent: 'candidate',
    }),
  });
  console.log('Candidate Reg Status:', candRegRes.status, await candRegRes.json());

  console.log(`\n2. Registering Company: ${compEmail}`);
  const compRegRes = await fetch('http://localhost:3000/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Acme Corp ${ts}`,
      email: compEmail,
      password,
      intent: 'company',
    }),
  });
  console.log('Company Reg Status:', compRegRes.status, await compRegRes.json());

  console.log('\n3. Verifying Database Records...');
  const candUser = await prisma.user.findUnique({
    where: { email: candEmail },
    include: {
      roles: { include: { role: true } },
      candidateProfile: true,
      companyMemberships: { include: { company: true } },
    },
  });
  console.log('Candidate DB User:', {
    email: candUser.email,
    roles: candUser.roles.map((r) => r.role.name),
    candidateProfileId: candUser.candidateProfile?.id,
    memberships: candUser.companyMemberships,
  });

  const compUser = await prisma.user.findUnique({
    where: { email: compEmail },
    include: {
      roles: { include: { role: true } },
      candidateProfile: true,
      companyMemberships: { include: { company: true } },
    },
  });
  console.log('Company DB User:', {
    email: compUser.email,
    roles: compUser.roles.map((r) => r.role.name),
    candidateProfileId: compUser.candidateProfile?.id,
    memberships: compUser.companyMemberships.map((m) => ({
      companyId: m.companyId,
      companyName: m.company.commercialName,
      role: m.role,
    })),
  });

  console.log('\n4. Testing /auth/me for Candidate...');
  const candLogin = await (
    await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: candEmail, password }),
    })
  ).json();
  const candMe = await (
    await fetch('http://localhost:3000/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${candLogin.accessToken}` },
    })
  ).json();
  console.log('Candidate /auth/me:', {
    email: candMe.email,
    roles: candMe.roles,
    candidateProfileId: candMe.candidateProfileId,
    memberships: candMe.memberships,
  });

  console.log('\n5. Testing /auth/me for Company...');
  const compLogin = await (
    await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: compEmail, password }),
    })
  ).json();
  const compMe = await (
    await fetch('http://localhost:3000/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${compLogin.accessToken}` },
    })
  ).json();
  console.log('Company /auth/me:', {
    email: compMe.email,
    roles: compMe.roles,
    candidateProfileId: compMe.candidateProfileId,
    memberships: compMe.memberships,
  });
}

createAndVerify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
