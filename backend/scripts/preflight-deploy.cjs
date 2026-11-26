#!/usr/bin/env node
/* Validate the production environment before Docker builds or restarts services. */
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const envFlag = args.indexOf('--env-file');
const envFile = envFlag >= 0 ? args[envFlag + 1] : '.env.staging';
if (!envFile || envFile.startsWith('--')) {
  console.error('Usage: node scripts/preflight-deploy.cjs --env-file .env.staging');
  process.exit(2);
}
const absolute = path.resolve(envFile);
if (!fs.existsSync(absolute)) {
  console.error(`Environment file not found: ${absolute}`);
  process.exit(2);
}

const values = {};
for (const line of fs.readFileSync(absolute, 'utf8').split(/\r?\n/)) {
  const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
  if (!match || match[1].startsWith('#')) continue;
  let value = match[2];
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  values[match[1]] = value;
}
const get = (key) => values[key] ?? process.env[key] ?? '';
const badPlaceholder = (value) => !value || /^<[^>]+>$/.test(value) || /\.\.\.|yourdomain|example\.com|change[-_]?me|provider[-_ ]key|price[-_ ]id|smtp[-_ ]host/i.test(value);
const errors = [], warnings = [];
const required = ['POSTGRES_PASSWORD', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'AI_API_KEY', 'STORAGE_SIGNING_SECRET', 'FRONTEND_URL', 'CORS_ORIGINS', 'NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_WS_URL', 'NEXT_PUBLIC_PARLOR_URL', 'STAGING_DOMAIN', 'PARLOR_DOMAIN'];
for (const key of required) if (badPlaceholder(get(key))) errors.push(`${key} is missing or still contains a template value`);
for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'AI_API_KEY', 'STORAGE_SIGNING_SECRET']) if (get(key) && get(key).length < 32) errors.push(`${key} must contain at least 32 characters`);
if (get('NODE_ENV') !== 'production') errors.push('NODE_ENV must be production');
if (get('COOKIE_SECURE') !== 'true') errors.push('COOKIE_SECURE must be true for a public HTTPS deployment');
if (!/Caddyfile\.prod$/.test(get('CADDY_CONFIG'))) errors.push('CADDY_CONFIG must point to ./deploy/Caddyfile.prod for a public VPS');
for (const key of ['FRONTEND_URL', 'NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_WS_URL', 'NEXT_PUBLIC_PARLOR_URL']) if (get(key) && !/^https:\/\//i.test(get(key))) errors.push(`${key} must use https://`);
try {
  const frontend = new URL(get('FRONTEND_URL'));
  const origins = get('CORS_ORIGINS').split(',').map((value) => value.trim()).filter(Boolean);
  if (!origins.includes(frontend.origin)) errors.push('CORS_ORIGINS must include FRONTEND_URL origin');
  if (!get('NEXT_PUBLIC_API_URL').startsWith(`${frontend.origin}/api/v1`)) errors.push('NEXT_PUBLIC_API_URL must use the frontend domain and /api/v1 prefix');
} catch { /* required checks above report invalid/missing URLs */ }

const storage = get('STORAGE_PROVIDER') || 's3';
if (storage === 's3') for (const key of ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY']) if (badPlaceholder(get(key))) errors.push(`${key} is required when STORAGE_PROVIDER=s3`);
const email = get('EMAIL_PROVIDER') || 'smtp';
if (email === 'smtp') for (const key of ['EMAIL_FROM', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) if (badPlaceholder(get(key))) errors.push(`${key} is required when EMAIL_PROVIDER=smtp`);
const payment = get('PAYMENT_PROVIDER') || 'stripe';
if (payment === 'dev') errors.push('PAYMENT_PROVIDER=dev is not allowed in production');
if (payment === 'stripe') for (const key of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_MAP_CANDIDATE_PRO_MONTHLY', 'STRIPE_PRICE_MAP_CANDIDATE_PRO_YEARLY', 'STRIPE_PRICE_MAP_CANDIDATE_CAREER_AI_MONTHLY', 'STRIPE_PRICE_MAP_CANDIDATE_CAREER_AI_YEARLY', 'STRIPE_PRICE_MAP_COMPANY_BUSINESS_MONTHLY', 'STRIPE_PRICE_MAP_COMPANY_BUSINESS_YEARLY', 'STRIPE_PRICE_MAP_COMPANY_PRO_MONTHLY', 'STRIPE_PRICE_MAP_COMPANY_PRO_YEARLY', 'STRIPE_PRICE_MAP_COMPANY_ENTERPRISE_MONTHLY', 'STRIPE_PRICE_MAP_COMPANY_ENTERPRISE_YEARLY']) if (badPlaceholder(get(key))) errors.push(`${key} is required when PAYMENT_PROVIDER=stripe`);
if (payment === 'konnect' || get('KONNECT_ENABLED') === 'true') {
  if (get('KONNECT_ENABLED') !== 'true') errors.push('KONNECT_ENABLED=true is required when PAYMENT_PROVIDER=konnect');
  for (const key of ['KONNECT_API_KEY', 'KONNECT_RECEIVER_WALLET_ID', 'KONNECT_WEBHOOK_URL']) if (badPlaceholder(get(key))) errors.push(`${key} is required when Konnect is enabled`);
  if (get('KONNECT_WEBHOOK_URL') && !/^https:\/\//i.test(get('KONNECT_WEBHOOK_URL'))) errors.push('KONNECT_WEBHOOK_URL must use https://');
  if (/^https:\/\//i.test(get('KONNECT_WEBHOOK_URL'))) {
    try {
      const callback = new URL(get('KONNECT_WEBHOOK_URL'));
      if (callback.pathname !== '/api/v1/payments/webhook/konnect' || callback.search || callback.hash) errors.push('KONNECT_WEBHOOK_URL must target /api/v1/payments/webhook/konnect without query parameters');
    } catch { errors.push('KONNECT_WEBHOOK_URL must be a valid URL'); }
  }
}
if (get('AI_PROVIDER') === 'openai' && badPlaceholder(get('OPENAI_API_KEY'))) errors.push('OPENAI_API_KEY is required when AI_PROVIDER=openai');
const profiles = get('COMPOSE_PROFILES').split(',').map((value) => value.trim()).filter(Boolean);
if (get('MIROFISH_ENABLED') === 'true') {
  if (!profiles.includes('mirofish')) errors.push('MIROFISH_ENABLED=true requires COMPOSE_PROFILES to include mirofish');
  if (!get('MIROFISH_SIMULATION_ID')) warnings.push('MIROFISH_ENABLED=true has no MIROFISH_SIMULATION_ID; recruiter practice will use the safe local fallback until a prepared simulation is supplied');
}
if (get('JOB_SOURCE_JOBOPS_ENABLED') === 'true' && !profiles.includes('jobops')) errors.push('JOB_SOURCE_JOBOPS_ENABLED=true requires COMPOSE_PROFILES to include jobops');
if (get('BIOMETRIC_ENABLED') === 'true' && badPlaceholder(get('BIOMETRIC_ENCRYPTION_KEY'))) errors.push('BIOMETRIC_ENCRYPTION_KEY is required when BIOMETRIC_ENABLED=true');

if (warnings.length) for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (errors.length) {
  console.error('Deployment preflight failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Deployment preflight passed for ${path.basename(absolute)} (${Object.keys(values).length} variables checked).`);
