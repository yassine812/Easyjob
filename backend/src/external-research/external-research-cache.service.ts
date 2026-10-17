import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExternalResearchResult, ResearchQueryType } from './external-research.types';

@Injectable()
export class ExternalResearchCacheService {
  private readonly logger = new Logger(ExternalResearchCacheService.name);
  constructor(private readonly prisma: PrismaService) {}

  async getFresh(key: string): Promise<ExternalResearchResult | null> {
    try {
      const row = await this.prisma.externalResearchCache.findUnique({ where: { key } });
      if (!row || row.expiresAt <= new Date() || row.status !== 'COMPLETED') return null;
      return row.resultJson as unknown as ExternalResearchResult;
    } catch (error) {
      this.logger.warn(`cache read failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }
  }

  async writeSuccess(key: string, provider: string, queryType: ResearchQueryType, normalizedQuery: string, result: ExternalResearchResult, expiresAt: Date) {
    try {
      await this.prisma.externalResearchCache.upsert({ where: { key }, create: { key, provider, queryType, normalizedQuery, resultJson: result as any, fetchedAt: new Date(), expiresAt, status: 'COMPLETED' }, update: { resultJson: result as any, fetchedAt: new Date(), expiresAt, status: 'COMPLETED', errorMessage: null } });
    } catch (error) {
      this.logger.warn(`cache write failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  async writeFailure(key: string, provider: string, queryType: ResearchQueryType, normalizedQuery: string, result: ExternalResearchResult, expiresAt: Date, errorMessage: string) {
    try {
      await this.prisma.externalResearchCache.upsert({ where: { key }, create: { key, provider, queryType, normalizedQuery, resultJson: result as any, fetchedAt: new Date(), expiresAt, status: 'FAILED', errorMessage: errorMessage.slice(0, 500) }, update: { resultJson: result as any, fetchedAt: new Date(), expiresAt, status: 'FAILED', errorMessage: errorMessage.slice(0, 500) } });
    } catch (error) {
      this.logger.warn(`cache failure write failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
