#!/usr/bin/env node
// Reports missing deployment settings without printing credentials or their values.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const args = process.argv.slice(2);
const envPath = args.includes('--env') ? args[args.indexOf('--env') + 1] : '.env.production';
if (!envPath || !fs.existsSync(envPath)) {
  console.error('Provide a production configuration: npm run release:check -- --env .env.production'); process.exit(1);
}
const env = { ...dotenv.parse(fs.readFileSync(envPath)), ...process.env };
const checks = [];
const check = (label, passed) => checks.push({ label, passed: !!passed });
const configured = value => typeof value === 'string' && value.length > 0 && !/[<>]|\.\.\.|change.?me|example|replace|test-secret/i.test(value);
const strong = value => configured(value) && value.length >= 32;
const https = value => { try { const u = new URL(value); return u.protocol === 'https:' && !/localhost|127\.0\.0\.1|example\.|\.local$/.test(u.hostname); } catch { return false; } };
check('NODE_ENV=production', env.NODE_ENV === 'production');
check('Node.js 22 or newer', Number(process.versions.node.split('.')[0]) >= 22);
check('Public HTTPS frontend URL', https(env.FRONTEND_URL));
check('HTTPS CORS origins', !!env.CORS_ORIGINS && env.CORS_ORIGINS.split(',').every(u => https(u.trim())));
check('Secure session cookies', env.COOKIE_SECURE === 'true');
check('Distinct, strong JWT secrets', strong(env.JWT_ACCESS_SECRET) && strong(env.JWT_REFRESH_SECRET) && env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET);
check('Database and Redis configured', (configured(env.DATABASE_URL) || strong(env.POSTGRES_PASSWORD)) && (configured(env.REDIS_URL) || configured(env.POSTGRES_DB)));
check('Rate limiting enabled', env.THROTTLE_ENABLED !== 'false');
check('SMTP delivery enabled', env.EMAIL_PROVIDER === 'smtp' && !!env.SMTP_HOST && !/mailpit|mailhog|localhost|127\.0\.0\.1/i.test(env.SMTP_HOST));
check('Sender email configured', !!(env.SMTP_FROM || env.EMAIL_FROM) && !/example\.|startupstarter\.app/.test(env.SMTP_FROM || env.EMAIL_FROM));
check('Authenticated AI service', strong(env.AI_API_KEY) && !!env.AI_SERVICE_URL);
check('Generative AI provider configured', env.AI_PROVIDER === 'openai' && configured(env.OPENAI_API_KEY));
check('Persistent file storage configured', env.STORAGE_PROVIDER === 's3'
  ? configured(env.S3_BUCKET) && configured(env.S3_ACCESS_KEY) && configured(env.S3_SECRET_KEY)
  : env.STORAGE_PROVIDER === 'local' && strong(env.STORAGE_SIGNING_SECRET));
check('Real payment provider configured', env.PAYMENT_PROVIDER === 'stripe'
  ? configured(env.STRIPE_SECRET_KEY) && env.STRIPE_SECRET_KEY.startsWith('sk_live_') && configured(env.STRIPE_WEBHOOK_SECRET)
  : env.PAYMENT_PROVIDER === 'konnect' && env.KONNECT_MODE === 'live' && configured(env.KONNECT_API_KEY) && configured(env.KONNECT_RECEIVER_WALLET_ID) && strong(env.KONNECT_WEBHOOK_SECRET));
if (env.PAYMENT_PROVIDER === 'stripe') for (const key of ['CANDIDATE_PRO_MONTHLY','CANDIDATE_PREMIUM_MONTHLY','COMPANY_BUSINESS_MONTHLY','COMPANY_ENTERPRISE_MONTHLY']) check(`Stripe price ${key}`, configured(env[`STRIPE_PRICE_MAP_${key}`]) || configured(env[`STRIPE_PRICE_MAP_CANDIDATE_CAREER_AI_MONTHLY`]));
if (env.BIOMETRIC_ENABLED === 'true') {
  check('Biometric encryption and liveness enabled', /^[a-f0-9]{64}$/i.test(env.BIOMETRIC_ENCRYPTION_KEY || '') && env.FACE_LIVENESS_ENABLED !== 'false');
  check('Server recognition model available', fs.existsSync(path.join(__dirname, '../ai-service/app/face/models/openface.nn4.small2.v1.t7')));
}
check('Local Face API assets available', fs.existsSync(path.join(__dirname, '../web/public/vendor/face-api/models/tiny_face_detector_model.bin')));
for (const item of checks) console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.label}`);
console.log('This configuration check does not replace SMTP inbox delivery, camera calibration, backup restore, or staging smoke tests.');
process.exitCode = checks.every(c => c.passed) ? 0 : 1;
