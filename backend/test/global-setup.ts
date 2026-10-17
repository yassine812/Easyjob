/* eslint-disable @typescript-eslint/no-var-requires */
import { execSync } from 'child_process';

/**
 * Runs before the e2e test suite. Applies all Prisma migrations to the test
 * database (created by docker-compose's postgres init script).
 */
export default async function globalSetup(): Promise<void> {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/startup_starter_test?schema=public';
  if (!/_test(?:_[0-9]+)?$/.test(new URL(databaseUrl).pathname.slice(1))) throw new Error('Refusing to migrate a non-test database in E2E');
  if (!process.env.REDIS_URL || new URL(process.env.REDIS_URL).port !== '6399') throw new Error('E2E requires dedicated Redis on port 6399');
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  // Clear any BullMQ keys left in the (test-dedicated) Redis from previous
  // runs so stale queue jobs can never be consumed by a newer test process
  // (which made email/notification capture flaky — see the E2E email fix).
  // Only the `bull:*` namespace is touched; nothing else in Redis is cleared.
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  try {
    const Redis = require('ioredis');
    const client = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    client.on('error', () => undefined);
    await client.connect();
    let cursor = '0';
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', 'bull:*', 'COUNT', '500');
      cursor = next;
      if (keys.length) await client.del(...keys);
    } while (cursor !== '0');
    await client.quit();
  } catch {
    // Redis unavailable is fine — suites will fail loudly on their own.
  }
}
