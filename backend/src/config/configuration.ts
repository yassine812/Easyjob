import '../common/utils/env';

/**
 * Central, typed application configuration.
 * All values are read from environment variables (see .env.example).
 */
export type StorageProvider = 'local' | 's3';
export type EmailProvider = 'console' | 'smtp';
export type PaymentProvider = 'dev' | 'stripe' | 'konnect';
export interface ExternalResearchConfig {
  enabled: boolean;
  agentReachEnabled: boolean;
  command: string;
  reaEnabled: boolean;
  reaCommand: string;
  reaArgs: string[];
  reaBrowserExecutable?: string;
  reaTimeoutMs: number;
  timeoutMs: number;
  maxRetries: number;
  circuitBreakerFailures: number;
  circuitBreakerCooldownMs: number;
  allowedSources: string[];
  ttlDays: { company: number; technology: number; github: number; rssHours: number };
}

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
  support?: {
    email: string;
  };
  ai: { baseUrl: string; timeoutMs: number; apiKey?: string };
  externalResearch?: ExternalResearchConfig;
  languageTool?: { url?: string; apiKey?: string; timeoutMs: number };
  skills?: {
    enabled: boolean;
    transcriptionEnabled: boolean;
    vadEnabled: boolean;
    liveAssistantEnabled: boolean;
    followupEnabled: boolean;
    coverageEnabled: boolean;
  };
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
      enabled?: boolean;
      apiBaseUrl?: string;
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
  billing?: {
    country: string;
    currency: 'TND';
    fxRatesUrl?: string;
    allowedCurrencies: Array<'TND' | 'EUR' | 'USD'>;
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
    support: {
      email: process.env.SUPPORT_EMAIL ?? '',
    },
    ai: {
      baseUrl: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
      timeoutMs: int(process.env.AI_SERVICE_TIMEOUT_MS, 30000),
      apiKey: process.env.AI_API_KEY || undefined,
    },
    externalResearch: {
      enabled: bool(process.env.EXTERNAL_RESEARCH_ENABLED, false),
      agentReachEnabled: bool(process.env.AGENT_REACH_ENABLED, false),
      command: process.env.AGENT_REACH_COMMAND ?? 'agent-reach',
      reaEnabled: bool(process.env.REA_ENABLED, false),
      reaCommand: process.env.REA_COMMAND ?? 'rea',
      reaArgs: commaList(process.env.REA_ARGS, []),
      reaBrowserExecutable: process.env.REA_BROWSER_EXECUTABLE || undefined,
      reaTimeoutMs: Math.min(120000, Math.max(5000, int(process.env.REA_TIMEOUT_MS, 30000))),
      timeoutMs: int(process.env.EXTERNAL_RESEARCH_TIMEOUT_MS, 15000),
      maxRetries: Math.min(2, Math.max(0, int(process.env.EXTERNAL_RESEARCH_MAX_RETRIES, 2))),
      circuitBreakerFailures: Math.max(1, int(process.env.EXTERNAL_RESEARCH_CIRCUIT_FAILURES, 3)),
      circuitBreakerCooldownMs: Math.max(1000, int(process.env.EXTERNAL_RESEARCH_CIRCUIT_COOLDOWN_MS, 60000)),
      allowedSources: commaList(process.env.EXTERNAL_RESEARCH_ALLOWED_SOURCES, ['web', 'github', 'rss']),
      ttlDays: {
        company: Math.max(1, int(process.env.EXTERNAL_RESEARCH_COMPANY_TTL_DAYS, 7)),
        technology: Math.max(1, int(process.env.EXTERNAL_RESEARCH_TECH_TTL_DAYS, 14)),
        github: Math.max(1, int(process.env.EXTERNAL_RESEARCH_GITHUB_TTL_DAYS, 3)),
        rssHours: Math.max(1, int(process.env.EXTERNAL_RESEARCH_RSS_TTL_HOURS, 3)),
      },
    },
    languageTool: {
      url: process.env.LANGUAGE_TOOL_URL || undefined,
      apiKey: process.env.LANGUAGE_TOOL_API_KEY || undefined,
      timeoutMs: int(process.env.LANGUAGE_TOOL_TIMEOUT_MS, 8000),
    },
    skills: {
      enabled: bool(process.env.EASYJOB_SKILLS_ENABLED, true),
      transcriptionEnabled: bool(process.env.INTERVIEW_TRANSCRIPTION_ENABLED, false),
      vadEnabled: bool(process.env.INTERVIEW_VAD_ENABLED, true),
      liveAssistantEnabled: bool(process.env.INTERVIEW_LIVE_ASSISTANT_ENABLED, true),
      followupEnabled: bool(process.env.INTERVIEW_FOLLOWUP_ENABLED, true),
      coverageEnabled: bool(process.env.INTERVIEW_SKILL_COVERAGE_ENABLED, true),
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
        enabled: bool(process.env.KONNECT_ENABLED, false),
        apiBaseUrl: process.env.KONNECT_API_BASE_URL || undefined,
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
    billing: {
      country: process.env.BILLING_COUNTRY ?? 'TN',
      currency: 'TND',
      fxRatesUrl: process.env.FX_RATES_URL || undefined,
      allowedCurrencies: ['TND', 'EUR', 'USD'],
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
