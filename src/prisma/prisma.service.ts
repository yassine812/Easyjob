import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    if (process.env.PRISMA_LOG === 'true') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).$on('query', (e: { query: string; params: string; duration: number }) => {
        this.logger.debug(`query=${e.query} params=${e.params} duration=${e.duration}ms`);
      });
    }
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Truncates every table (used by tests only).
   */
  async cleanDatabase(): Promise<void> {
    const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
    if (process.env.NODE_ENV !== 'test' || !/_test(?:_[0-9]+)?$/.test(databaseName)) {
      throw new Error('Database cleanup requires an explicitly named test database and NODE_ENV=test');
    }
    const tables = await this.$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations')`,
    );
    for (const { tablename } of tables) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE`);
    }
  }
}
