import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AggregatedJobStatus, JobSourceType, Prisma, SourceApplicationMethod } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JoobleAdapter } from './sources/jooble.adapter';
import type { ExternalJobSearchInput } from './sources/job-source.types';

const CACHE_TTL_MS = 15 * 60 * 1000;
const normalizePart = (value: string) => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

@Injectable()
export class JobAggregationService {
  private readonly logger = new Logger(JobAggregationService.name);
  private readonly searchCache = new Map<string, { expiresAt: number; promise: Promise<AggregatedSearch> }>();

  constructor(private readonly prisma: PrismaService, private readonly jooble: JoobleAdapter) {}

  async search(input: ExternalJobSearchInput): Promise<AggregatedSearch> {
    const source = await this.ensureJoobleSource();
    if (!this.jooble.isConfigured()) {
      return { items: [], total: 0, configured: false, lastSyncedAt: source.lastSyncAt };
    }

    const cacheKey = createHash('sha1').update(`${normalizePart(input.keyword)}|${normalizePart(input.location)}|${input.page ?? 1}`).digest('hex');
    const cached = this.searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.promise;
    if (cached) this.searchCache.delete(cacheKey);

    const promise = this.fetchAndSync(source.id, input);
    this.searchCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, promise });
    try {
      return await promise;
    } catch (error) {
      this.searchCache.delete(cacheKey);
      await this.prisma.jobSource.update({ where: { id: source.id }, data: { syncStatus: 'FAILED' } }).catch(() => undefined);
      this.logger.warn(`Jooble search failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      return { items: [], total: 0, configured: true, lastSyncedAt: source.lastSyncAt, error: 'SOURCE_UNAVAILABLE' };
    }
  }

  async findOpenJob(id: string) {
    const job = await this.prisma.aggregatedJob.findFirst({
      where: { id, status: AggregatedJobStatus.OPEN, OR: [{ closingAt: null }, { closingAt: { gt: new Date() } }] },
      include: { sources: { include: { source: true }, orderBy: { lastSyncedAt: 'desc' } } },
    });
    if (!job) throw new NotFoundException('External job is no longer available');
    return job;
  }

  async getJob(id: string) {
    const job = await this.prisma.aggregatedJob.findUnique({
      where: { id },
      include: { sources: { include: { source: true }, orderBy: { lastSyncedAt: 'desc' } } },
    });
    if (!job) throw new NotFoundException('External job not found');
    if (job.closingAt && job.closingAt <= new Date() && job.status === 'OPEN') {
      return this.prisma.aggregatedJob.update({
        where: { id }, data: { status: 'CLOSED' },
        include: { sources: { include: { source: true }, orderBy: { lastSyncedAt: 'desc' } } },
      });
    }
    return job;
  }

  private async ensureJoobleSource() {
    return this.prisma.jobSource.upsert({
      where: { type: JobSourceType.JOOBLE },
      create: { type: JobSourceType.JOOBLE, name: this.jooble.name, enabled: this.jooble.isConfigured(), syncStatus: this.jooble.isConfigured() ? 'READY' : 'NOT_CONFIGURED' },
      update: { name: this.jooble.name, enabled: this.jooble.isConfigured(), ...(!this.jooble.isConfigured() ? { syncStatus: 'NOT_CONFIGURED' } : {}) },
    });
  }

  private async fetchAndSync(sourceId: string, input: ExternalJobSearchInput): Promise<AggregatedSearch> {
    const result = await this.jooble.search(input);
    const syncedAt = new Date();
    const ids: string[] = [];
    for (const listing of result.jobs) {
      const normalizedCompany = listing.companyName ? normalizePart(listing.companyName) : `undisclosed-${listing.id}`;
      const dedupeKey = createHash('sha256')
        .update([normalizedCompany, normalizePart(listing.title), normalizePart(listing.location || '')].join('|'))
        .digest('hex');
      const saved = await this.prisma.$transaction(async (tx) => {
        const job = await tx.aggregatedJob.upsert({
          where: { dedupeKey },
          create: {
            dedupeKey,
            title: listing.title,
            companyName: listing.companyName,
            location: listing.location,
            description: listing.description,
            salaryText: listing.salaryText,
            employmentType: listing.employmentType,
            lastSyncedAt: syncedAt,
          },
          update: {
            title: listing.title,
            companyName: listing.companyName,
            location: listing.location,
            description: listing.description,
            salaryText: listing.salaryText,
            employmentType: listing.employmentType,
            lastSyncedAt: syncedAt,
            status: 'OPEN',
          },
        });
        await tx.aggregatedJobSource.upsert({
          where: { sourceId_sourceJobId: { sourceId, sourceJobId: listing.id } },
          create: {
            aggregatedJobId: job.id,
            sourceId,
            sourceJobId: listing.id,
            sourceLabel: listing.sourceLabel,
            originalUrl: listing.url,
            applicationUrl: listing.url,
            applicationMethod: SourceApplicationMethod.EXTERNAL_APPLICATION,
            sourceUpdatedAt: listing.sourceUpdatedAt,
            lastSyncedAt: syncedAt,
          },
          update: {
            aggregatedJobId: job.id,
            sourceLabel: listing.sourceLabel,
            originalUrl: listing.url,
            applicationUrl: listing.url,
            applicationMethod: SourceApplicationMethod.EXTERNAL_APPLICATION,
            sourceUpdatedAt: listing.sourceUpdatedAt,
            lastSyncedAt: syncedAt,
          },
        });
        return job;
      });
      ids.push(saved.id);
    }

    await this.prisma.jobSource.update({ where: { id: sourceId }, data: { enabled: true, syncStatus: 'READY', lastSyncAt: syncedAt } });
    const uniqueIds = [...new Set(ids)];
    const items = uniqueIds.length ? await this.prisma.aggregatedJob.findMany({
      where: { id: { in: uniqueIds }, status: 'OPEN', OR: [{ closingAt: null }, { closingAt: { gt: syncedAt } }] },
      include: { sources: { include: { source: true }, orderBy: { lastSyncedAt: 'desc' } } },
    }) : [];
    return {
      items: items.sort((a, b) => (ids.indexOf(a.id) - ids.indexOf(b.id))),
      total: result.total,
      configured: true,
      lastSyncedAt: syncedAt,
    };
  }
}

export interface AggregatedSearch {
  items: Array<Prisma.AggregatedJobGetPayload<{ include: { sources: { include: { source: true } } } }>>;
  total: number;
  configured: boolean;
  lastSyncedAt: Date | null;
  error?: 'SOURCE_UNAVAILABLE';
}
