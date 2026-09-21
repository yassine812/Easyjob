import { config as loadDotenv } from 'dotenv';

/**
 * Loads .env into process.env as early as possible. @nestjs/config also loads
 * it, but only during module initialization — after import-time side effects
 * have already run. dotenv never overrides existing environment variables,
 * so explicit env vars (docker, CI) always win.
 */
loadDotenv({ quiet: true });

export const RUN_WORKERS = process.env.RUN_WORKERS === 'true';
