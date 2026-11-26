const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync, rmdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function check(overrides = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'easyjob-preflight-'));
  const file = path.join(dir, '.env.test');
  const env = {
    NODE_ENV: 'production', COOKIE_SECURE: 'true', CADDY_CONFIG: './deploy/Caddyfile.prod',
    POSTGRES_PASSWORD: 'isolated-deployment-test-password',
    JWT_ACCESS_SECRET: 'a'.repeat(48), JWT_REFRESH_SECRET: 'b'.repeat(48),
    AI_API_KEY: 'c'.repeat(48), STORAGE_SIGNING_SECRET: 'd'.repeat(48),
    FRONTEND_URL: 'https://easyjob.invalid', CORS_ORIGINS: 'https://easyjob.invalid',
    NEXT_PUBLIC_API_URL: 'https://easyjob.invalid/api/v1', NEXT_PUBLIC_WS_URL: 'https://easyjob.invalid',
    NEXT_PUBLIC_PARLOR_URL: 'https://practice.easyjob.invalid', STAGING_DOMAIN: 'easyjob.invalid',
    PARLOR_DOMAIN: 'practice.easyjob.invalid', STORAGE_PROVIDER: 'local', EMAIL_PROVIDER: 'console',
    PAYMENT_PROVIDER: 'konnect', KONNECT_ENABLED: 'true', KONNECT_API_KEY: 'isolated-test-key',
    KONNECT_RECEIVER_WALLET_ID: 'isolated-test-wallet',
    KONNECT_WEBHOOK_URL: 'https://easyjob.invalid/api/v1/payments/webhook/konnect',
    ...overrides,
  };
  try {
    writeFileSync(file, Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n'));
    const result = spawnSync(process.execPath, [path.join(__dirname, 'preflight-deploy.cjs'), '--env-file', file], { encoding: 'utf8' });
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    rmSync(file);
    rmdirSync(dir);
  }
}

test('accepts complete Konnect configuration without a custom POST signature', () => {
  assert.equal(check({ KONNECT_WEBHOOK_SECRET: '' }).status, 0);
});
test('refuses missing merchant credentials and never prints credential values', () => {
  const result = check({ KONNECT_API_KEY: '', KONNECT_RECEIVER_WALLET_ID: '' });
  assert.equal(result.status, 1);
  assert.match(result.output, /KONNECT_API_KEY/);
  assert.match(result.output, /KONNECT_RECEIVER_WALLET_ID/);
  assert.doesNotMatch(result.output, /isolated-deployment-test-password/);
});
test('refuses disabled Konnect and an insecure callback URL', () => {
  const result = check({ KONNECT_ENABLED: 'false', KONNECT_WEBHOOK_URL: 'http://easyjob.invalid/callback' });
  assert.equal(result.status, 1);
  assert.match(result.output, /KONNECT_ENABLED=true/);
  assert.match(result.output, /KONNECT_WEBHOOK_URL must use https/);
});
test('refuses a development payment provider in production', () => {
  const result = check({ PAYMENT_PROVIDER: 'dev' });
  assert.equal(result.status, 1);
  assert.match(result.output, /dev is not allowed/);
});
test('refuses a callback URL that points at a nonexistent EasyJob route', () => {
  const result = check({ KONNECT_WEBHOOK_URL: 'https://easyjob.invalid/billing/konnect/webhook' });
  assert.equal(result.status, 1);
  assert.match(result.output, /must target \/api\/v1\/payments\/webhook\/konnect/);
});
