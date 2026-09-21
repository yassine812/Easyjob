import '../common/utils/env';

/**
 * Central, typed application configuration.
 * All values are read from environment variables (see .env.example).
 */
export type StorageProvider = 'local' | 's3';
export type EmailProvider = 'console' | 'smtp';
export type PaymentProvider = 'dev' | 'stripe' | 'konnect';

export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  frontendUrl: string;
  corsOrigins: string[];
  cookie: {
    name: string;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    domain?: string;
  };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
    refreshTokenTtlDays: number;
  };
  bcryptRounds: number;
  databaseUrl: string;
  redis: { url: string };
  throttle: { enabled: boolean; ttlMs: number; limit: number; authTtlMs: number; authLimit: number };
  storage: {
    provider: StorageProvider;
    localDir: string;
    s3: {
      endpoint: string;
      region: string;
      bucket: string;
      accessKey: string;
      secretKey: string;
      forcePathStyle: boolean;
      presignExpiresSec: number;
    };
  };
  email: {
    provider: EmailProvider;
    from: string;
    smtp: { host: string; port: number; secure: boolean; user: string; pass: string };
  };
  ai: { baseUrl: string; timeoutMs: number; apiKey?: string };
  biometric: {
    enabled: boolean;
    encryptionKey: string;
    matchThreshold: number;
    livenessEnabled: boolean;
    maxAttempts: number;
    attemptWindowMs: number;
    blockMs: number;
    challengeTtlSeconds: number;
    faceServiceUrl: string;
    maxImageBytes: number;
  };
  payment: {
    provider: PaymentProvider;
    devWebhookSecret: string;
    konnect?: {
      apiKey: string;
      receiverWalletId: string;
      mode: 'sandbox' | 'live';
      webhookSecret: string;
      webhookUrl?: string;
    };
    stripe: {
      secretKey?: string;
      webhookSecret?: string;
      priceMap: Record<string, string>;
    };
  };
  logLevel: string;
  runWorkers: boolean;
}

const bool = (v: string | undefined, def = false): boolean =>
  v === undefined ? def : v.toLowerCase() === 'true' || v === '1';

const int = (v: string | undefined, def: number): number => {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : def;
};

const float = (v: string | undefined, def: number): number => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : def;
};

const commaList = (v: string | undefined, def: string[]): string[] =>
  v && v.trim().length > 0 ? v.split(',').map((s) => s.trim()) : def;

export function loadConfig(): AppConfig {
  const env = process.env.NODE_ENV ?? 'development';
  const config: AppConfig = {
    env,
    port: int(process.env.PORT, 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    corsOrigins: commaList(process.env.CORS_ORIGINS, ['http://localhost:3001', 'http://localhost:3000', 'http://localhost:5173']),
    cookie: {
      name: process.env.COOKIE_NAME ?? 'refresh_token',
      secure: bool(process.env.COOKIE_SECURE, env === 'production'),
      sameSite: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ?? (env === 'production' ? 'lax' : 'lax'),
      domain: process.env.COOKIE_DOMAIN || undefined,
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
      refreshTokenTtlDays: int(process.env.REFRESH_TOKEN_TTL_DAYS, 30),
    },
    bcryptRounds: int(process.env.BCRYPT_ROUNDS, 10),
    databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/startup_starter?schema=public',
    redis: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    throttle: {
      enabled: bool(process.env.THROTTLE_ENABLED, true),
      ttlMs: int(process.env.THROTTLE_TTL_MS, 60000),
      limit: int(process.env.THROTTLE_LIMIT, 120),
      authTtlMs: int(process.env.AUTH_THROTTLE_TTL_MS, 60000),
      authLimit: int(process.env.AUTH_THROTTLE_LIMIT, 10),
    },
    storage: {
      provider: (process.env.STORAGE_PROVIDER as StorageProvider) ?? 'local',
      localDir: process.env.LOCAL_STORAGE_DIR ?? 'storage',
      s3: {
        endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
        region: process.env.S3_REGION ?? 'us-east-1',
        bucket: process.env.S3_BUCKET ?? 'startup-starter',
        accessKey: process.env.S3_ACCESS_KEY ?? '',
        secretKey: process.env.S3_SECRET_KEY ?? '',
        forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, true),
        presignExpiresSec: int(process.env.S3_PRESIGN_EXPIRES_SEC, 900),
      },
    },
    email: {
      provider: (process.env.EMAIL_PROVIDER as EmailProvider) ?? 'console',
      from: process.env.EMAIL_FROM ?? 'Startup Starter <no-reply@startupstarter.app>',
      smtp: {
        host: process.env.SMTP_HOST ?? 'localhost',
        port: int(process.env.SMTP_PORT, 1025),
        secure: bool(process.env.SMTP_SECURE, false),
        user: process.env.SMTP_USER ?? '',
        pass: process.env.SMTP_PASS ?? '',
      },
    },
    ai: {
      baseUrl: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
      timeoutMs: int(process.env.AI_SERVICE_TIMEOUT_MS, 30000),
      apiKey: process.env.AI_API_KEY || undefined,
    },
    biometric: {
      // Feature flag — off by default until validated in staging.
      enabled: bool(process.env.BIOMETRIC_ENABLED, false),
      // AES-256-GCM key: 64 hex chars (32 bytes) — see docs/PRIVACY.md.
      encryptionKey: process.env.BIOMETRIC_ENCRYPTION_KEY ?? '',
      // Minimum cosine similarity (1 = identical; 0 = orthogonal).
      matchThreshold: float(process.env.FACE_MATCH_THRESHOLD, 0.5),
      livenessEnabled: bool(process.env.FACE_LIVENESS_ENABLED, true),
      maxAttempts: int(process.env.FACE_MAX_ATTEMPTS, 5),
      attemptWindowMs: int(process.env.FACE_ATTEMPT_WINDOW_MS, 600000),
      blockMs: int(process.env.FACE_BLOCK_MS, 600000),
      challengeTtlSeconds: int(process.env.FACE_CHALLENGE_TTL_SECONDS, 120),
      faceServiceUrl: process.env.AI_FACE_SERVICE_URL || process.env.AI_SERVICE_URL || 'http://localhost:8000',
      maxImageBytes: int(process.env.FACE_MAX_IMAGE_BYTES, 5 * 1024 * 1024),
    },
    payment: {
      provider: (process.env.PAYMENT_PROVIDER as PaymentProvider) ?? 'dev',
      devWebhookSecret: process.env.DEV_WEBHOOK_SECRET ?? 'dev-webhook-secret',
      konnect: {
        webhookUrl: process.env.KONNECT_WEBHOOK_URL,
        apiKey: process.env.KONNECT_API_KEY ?? '',
        receiverWalletId: process.env.KONNECT_RECEIVER_WALLET_ID ?? '',
        mode: (process.env.KONNECT_MODE as 'sandbox' | 'live') ?? 'sandbox',
        webhookSecret: process.env.KONNECT_WEBHOOK_SECRET ?? 'konnect-webhook-secret-dev',
      },
      stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY || undefined,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || undefined,
        priceMap: {
          candidate_pro_monthly: process.env.STRIPE_PRICE_MAP_CANDIDATE_PRO_MONTHLY ?? '',
          candidate_pro_yearly: process.env.STRIPE_PRICE_MAP_CANDIDATE_PRO_YEARLY ?? '',
          candidate_premium_monthly: process.env.STRIPE_PRICE_MAP_CANDIDATE_PREMIUM_MONTHLY ?? process.env.STRIPE_PRICE_MAP_CANDIDATE_CAREER_AI_MONTHLY ?? '',
          candidate_premium_yearly: process.env.STRIPE_PRICE_MAP_CANDIDATE_PREMIUM_YEARLY ?? process.env.STRIPE_PRICE_MAP_CANDIDATE_CAREER_AI_YEARLY ?? '',
          company_business_monthly: process.env.STRIPE_PRICE_MAP_COMPANY_BUSINESS_MONTHLY ?? '',
          company_business_yearly: process.env.STRIPE_PRICE_MAP_COMPANY_BUSINESS_YEARLY ?? '',
          company_pro_monthly: process.env.STRIPE_PRICE_MAP_COMPANY_PRO_MONTHLY ?? '',
          company_pro_yearly: process.env.STRIPE_PRICE_MAP_COMPANY_PRO_YEARLY ?? '',
          company_enterprise_monthly: process.env.STRIPE_PRICE_MAP_COMPANY_ENTERPRISE_MONTHLY ?? '',
          company_enterprise_yearly: process.env.STRIPE_PRICE_MAP_COMPANY_ENTERPRISE_YEARLY ?? '',
        },
      },
    },
    logLevel: process.env.LOG_LEVEL ?? 'info',
    runWorkers: bool(process.env.RUN_WORKERS, false),
  };

  if (config.jwt.accessSecret.length < 16) {
    throw new Error('JWT_ACCESS_SECRET must be set and at least 16 characters long');
  }
  if (config.jwt.refreshSecret.length < 16) {
    throw new Error('JWT_REFRESH_SECRET must be set and at least 16 characters long');
  }
  return config;
}

export const CONFIG = Symbol('APP_CONFIG');
