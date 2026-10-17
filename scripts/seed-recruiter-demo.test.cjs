const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const bcrypt = require('bcryptjs');

// Execute the real seed against an in-memory database. Stop after the user
// operations so this regression never creates jobs or touches a real database.
function harness(existingCandidate = true) {
  const owner = { id: 'owner', passwordHash: 'owner-chosen-hash', status: 'ACTIVE' };
  let candidate = existingCandidate ? { id: 'candidate', passwordHash: 'candidate-chosen-hash', status: 'SUSPENDED', emailVerifiedAt: null } : null;
  const stop = new Error('Reached profile content');
  let features = {};
  const db = {
    company: { findFirst: async () => ({ id: 'company', commercialName: 'Demo', members: [{ role: 'COMPANY_ADMIN', status: 'ACTIVE', user: owner }] }) },
    plan: {
      findFirst: async () => ({ id: 'plan', features }),
      update: async ({ data }) => { features = data.features; },
    },
    subscription: {
      deleteMany: async () => ({}), create: async () => ({}),
      findFirst: async () => ({ plan: { features } }),
    },
    user: {
      update: async ({ data }) => Object.assign(owner, data),
      upsert: async ({ create, update }) => {
        candidate = candidate ? Object.assign(candidate, update) : { id: 'candidate', ...create };
        return candidate;
      },
    },
    candidateProfile: { upsert: async () => { throw stop; } },
  };
  const context = vm.createContext({
    require: name => name === '@prisma/client' ? { PrismaClient: function () { return db; } }
      : name === 'bcryptjs' ? bcrypt : {},
    module: { exports: {} }, console: { log() {} },
    process: { env: { NODE_ENV: 'test' }, argv: ['node', 'seed', '--max-plan'] },
  });
  vm.runInContext(fs.readFileSync(require.resolve('./seed-recruiter-demo.cjs'), 'utf8'), context);
  return { context, owner, candidate: () => candidate, stop };
}

test('enabling the maximal demo plan preserves owner and existing candidate credentials', async () => {
  const h = harness();
  await assert.rejects(h.context.main(), error => error === h.stop);
  assert.equal(h.owner.passwordHash, 'owner-chosen-hash');
  assert.equal(h.candidate().passwordHash, 'candidate-chosen-hash');
  assert.equal(h.candidate().status, 'SUSPENDED');
  assert.equal(h.candidate().emailVerifiedAt, null);
});

test('new demo candidates still receive a usable password', async () => {
  const h = harness(false);
  await assert.rejects(h.context.main(), error => error === h.stop);
  assert.equal(h.candidate().status, 'ACTIVE');
  assert.equal(await bcrypt.compare('EasyJobRecruiterDemo2026!', h.candidate().passwordHash), true);
});
