import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { AggregatedJobStatus, JobSourceType, Prisma, SourceApplicationMethod } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JoobleAdapter } from './sources/jooble.adapter';
import { AnetiAdapter } from './sources/aneti.adapter';
import { AnetiInternationalAdapter } from './sources/aneti-international.adapter';
import { TanitJobsAdapter } from './sources/tanitjobs.adapter';
import { LinkedInAdapter } from './sources/linkedin.adapter';
import { PartnerSourceRegistry } from './sources/partner-source.registry';
import { SourceRequestError, httpsUrl } from './sources/licensed-feed.adapter';
import { sameVacancy } from './job-identity';
import { repairKnownCorruption } from './sources/public-html';
import type { ExternalJobListing, ExternalJobSearchInput, JobSourceAdapter, JobSourceStatus } from './sources/job-source.types';

const normalizePart = (value: string) => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const SOURCE_STATUSES: JobSourceStatus[] = ['ACTIVE', 'CONFIGURATION_REQUIRED', 'UNAUTHORIZED', 'TEMPORARILY_UNAVAILABLE', 'ERROR', 'DISABLED', 'INTEGRATION_REQUIRED', 'AUTHORIZATION_REQUIRED', 'PARTNER_REQUIRED'];
const JOB_INCLUDE = { sources: { select: { id: true, sourceId: true, sourceJobId: true, sourceLabel: true, originalUrl: true, applicationUrl: true, applicationMethod: true, applicationFields: true, status: true, sourceUpdatedAt: true, lastSyncedAt: true, source: true }, orderBy: { lastSyncedAt: 'desc' as const } } };
const chunks = <T>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

@Injectable()
export class JobAggregationService {
  private readonly logger = new Logger(JobAggregationService.name);
  private readonly adapters: JobSourceAdapter[];

  constructor(
    private readonly prisma: PrismaService,
    jooble: JoobleAdapter,
    aneti: AnetiAdapter,
    anetiInternational: AnetiInternationalAdapter,
    tanitJobs: TanitJobsAdapter,
    linkedIn: LinkedInAdapter,
    @Optional() registry?: PartnerSourceRegistry,
  ) {
    this.adapters = [jooble, aneti, anetiInternational, ...(registry?.adapters ?? [tanitJobs, linkedIn])];
  }

  getAdapters() { return this.adapters; }

  /** Candidate searches are read-only and use only the centrally stored catalogue. */
  async search(input: ExternalJobSearchInput): Promise<AggregatedSearch> {
    const now = new Date();
    // The marketplace merges external listings with EasyJob company jobs after querying each store.
    // Read only the requested result prefix; source status/counts are handled separately.
    const page = Math.max(1, input.page ?? 1), limit = Math.min(10_000, Math.max(1, input.limit ?? 20));
    const where = this.searchWhere(input, now);
    const [total, items, sources] = await Promise.all([
      this.prisma.aggregatedJob.count({ where }),
      this.prisma.aggregatedJob.findMany({
        where,
        include: JOB_INCLUDE,
        orderBy: this.orderBy(input.sort),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.jobSource.findMany({ select: { lastSyncAt: true } }),
    ]);
    const lastSyncedAt = sources.reduce<Date | null>((latest, source) => !source.lastSyncAt || (latest && latest > source.lastSyncAt) ? latest : source.lastSyncAt, null);
    return { items, total, configured: this.adapters.some(adapter => adapter.isConfigured()), lastSyncedAt };
  }

  /** Run by the BullMQ worker only. A source error is recorded without stopping other sources. */
  async syncSource(type: JobSourceType): Promise<SourceSyncResult> {
    const adapter = this.adapters.find(item => item.type === type);
    if (!adapter) return { type, status: 'ERROR', imported: 0, duplicatesMerged: 0, total: 0 };
    const source = await this.ensureSource(adapter);
    const health = await adapter.healthCheck();
    if (health.status !== 'ACTIVE' || !adapter.isConfigured()) {
      await this.prisma.jobSource.update({ where: { id: source.id }, data: { enabled: false, syncStatus: health.status } });
      return { type, status: health.status, imported: 0, duplicatesMerged: 0, total: 0 };
    }

    const started = Date.now();
    const run = await this.prisma.jobSourceSyncRun.create({ data: { sourceId: source.id, status: 'RUNNING' } });
    try {
      const result = await adapter.fetchJobs();
      const syncedAt = new Date();
      const stored = await this.storeListings(source.id, result.jobs, syncedAt);
      let expired = 0;
      // Reconcile source references independently; another source can still have an active copy.
      if (result.complete === true && !result.rejected && !stored.rejected) {
        await this.prisma.aggregatedJobSource.updateMany({
          where: { sourceId: source.id, status: 'OPEN', lastSyncedAt: { lt: syncedAt }, missingSince: null },
          data: { missingSince: syncedAt },
        });
        const configuredGrace = Number(process.env.JOB_SOURCE_MISSING_GRACE_HOURS);
        const graceHours = Number.isFinite(configuredGrace) && configuredGrace >= 1 ? configuredGrace : 72;
        await this.prisma.aggregatedJobSource.updateMany({
          where: { sourceId: source.id, status: 'OPEN', missingSince: { lte: new Date(syncedAt.getTime() - graceHours * 3600_000) } },
          data: { status: 'REMOVED' },
        });
      }
      expired += (await this.prisma.aggregatedJob.updateMany({
        where: { status: 'OPEN', closingAt: { lte: syncedAt } }, data: { status: 'EXPIRED' },
      })).count;
      expired += (await this.prisma.aggregatedJob.updateMany({
        where: { status: 'OPEN', sources: { some: { sourceId: source.id }, none: { status: 'OPEN' } } },
        data: { status: 'NO_LONGER_AVAILABLE' },
      })).count;
      const durationMs = Date.now() - started;
      const rejected = stored.rejected + (result.rejected || 0);
      await this.prisma.jobSource.update({ where: { id: source.id }, data: {
        enabled: true, syncStatus: 'ACTIVE', lastSyncAt: syncedAt, lastDurationMs: durationMs,
        lastErrorCode: null, lastHttpStatus: null, lastImported: stored.imported, lastUpdated: stored.updated,
        lastRejected: rejected, lastExpired: expired, lastDuplicates: stored.duplicatesMerged,
      } });
      await this.prisma.jobSourceSyncRun.update({ where: { id: run.id }, data: {
        status: 'ACTIVE', finishedAt: syncedAt, durationMs, imported: stored.imported, updated: stored.updated,
        rejected, expired, duplicates: stored.duplicatesMerged,
      } });
      return { type, status: 'ACTIVE', imported: stored.imported, duplicatesMerged: stored.duplicatesMerged, total: result.total };
    } catch (error) {
      const code = error instanceof SourceRequestError ? error.code : 'SOURCE_SYNC_FAILED';
      const httpStatus = error instanceof SourceRequestError ? error.httpStatus : undefined;
      const status = httpStatus === 401 || httpStatus === 403 ? 'AUTHORIZATION_REQUIRED' : 'TEMPORARILY_UNAVAILABLE';
      const finishedAt = new Date(), durationMs = Date.now() - started;
      await this.prisma.jobSource.update({ where: { id: source.id }, data: { syncStatus: status, lastFailureAt: finishedAt, lastErrorCode: code, lastHttpStatus: httpStatus ?? null, lastDurationMs: durationMs } });
      await this.prisma.jobSourceSyncRun.update({ where: { id: run.id }, data: { status, finishedAt, durationMs, errorCode: code, httpStatus } });
      this.logger.warn(`${adapter.name} sync failed: ${code}`);
      return { type, status, imported: 0, duplicatesMerged: 0, total: 0, retryAfterMs: error instanceof SourceRequestError ? error.retryAfterMs : undefined };
    }
  }

  async sourceStatuses(includeCounts = true) {
    return Promise.all(this.adapters.map(async adapter => {
      const row = await this.prisma.jobSource.findUnique({ where: { type: adapter.type } });
      const health = await adapter.healthCheck();
      const status = adapter.isConfigured() && !row?.lastSyncAt ? 'CONFIGURATION_REQUIRED' : adapter.isConfigured() && row && SOURCE_STATUSES.includes(row.syncStatus as JobSourceStatus)
        ? row.syncStatus as JobSourceStatus
        : health.status;
      const sourceId = row?.id;
      const [listingCount, activeJobs, closedJobs] = sourceId && includeCounts ? await Promise.all([
        this.prisma.aggregatedJobSource.count({ where: { sourceId } }),
        this.prisma.aggregatedJob.count({ where: { status: AggregatedJobStatus.OPEN, OR: [{ closingAt: null }, { closingAt: { gt: new Date() } }], sources: { some: { sourceId, status: 'OPEN' } } } }),
        this.prisma.aggregatedJob.count({ where: { status: { not: AggregatedJobStatus.OPEN }, sources: { some: { sourceId } } } }),
      ]) : [0, 0, 0];
      return {
        type: adapter.type,
        name: adapter.name,
        status,
        detail: adapter.isConfigured() && !row?.lastSyncAt ? 'Feed configured; awaiting the first successful synchronization.' : health.detail,
        enabled: adapter.isConfigured() && status === 'ACTIVE',
        lastSyncAt: row?.lastSyncAt ?? null,
        info: adapter.getSourceInfo?.() ?? null,
        application: adapter.getApplicationCapabilities?.() ?? { method: 'EXTERNAL_ONLY', verified: true, reason: 'External employer navigation only' },
        lastFailureAt: row?.lastFailureAt ?? null, lastErrorCode: row?.lastErrorCode ?? null,
        lastHttpStatus: row?.lastHttpStatus ?? null, lastDurationMs: row?.lastDurationMs ?? null,
        lastImported: row?.lastImported ?? 0, lastUpdated: row?.lastUpdated ?? 0,
        lastRejected: row?.lastRejected ?? 0, lastExpired: row?.lastExpired ?? 0, lastDuplicates: row?.lastDuplicates ?? 0,
        listingCount,
        activeJobs,
        closedJobs,
      };
    }));
  }

  async findOpenJob(id: string) {
    const job = await this.prisma.aggregatedJob.findFirst({
      where: { id, sources: { some: { status: 'OPEN', source: { type: { in: this.adapters.filter(a => a.isConfigured()).map(a => a.type) } } } }, status: AggregatedJobStatus.OPEN, OR: [{ closingAt: null }, { closingAt: { gt: new Date() } }] },
      include: JOB_INCLUDE,
    });
    if (!job) throw new NotFoundException('External job is no longer available');
    return job;
  }

  async getJob(id: string) {
    const job = await this.prisma.aggregatedJob.findUnique({ where: { id }, include: JOB_INCLUDE });
    if (!job || !job.sources.some(reference => this.adapters.some(adapter => adapter.type === reference.source.type && adapter.isConfigured()))) throw new NotFoundException('External job is unavailable from an authorized source');
    if (job.closingAt && job.closingAt <= new Date() && job.status === AggregatedJobStatus.OPEN) {
      await this.prisma.aggregatedJob.update({ where: { id }, data: { status: AggregatedJobStatus.CLOSED } });
      throw new NotFoundException('External job is no longer available');
    }
    if (job.status !== AggregatedJobStatus.OPEN) throw new NotFoundException('External job is no longer available');
    return job;
  }

  private searchWhere(input: ExternalJobSearchInput, now: Date): Prisma.AggregatedJobWhereInput {
    const and: Prisma.AggregatedJobWhereInput[] = [
      { status: AggregatedJobStatus.OPEN },
      { sources: { some: { status: 'OPEN', source: { type: { in: this.adapters.filter(a => a.isConfigured()).map(a => a.type) } } } } },
      { OR: [{ closingAt: null }, { closingAt: { gt: now } }] },
    ];
    const textSearch = (value: string, fields: Array<'title' | 'companyName' | 'description'>): Prisma.AggregatedJobWhereInput => ({
      OR: [...fields.map(field => ({ [field]: { contains: value, mode: 'insensitive' as const } })), ...(['skills', 'requirements', 'responsibilities', 'benefits', 'niceToHave', 'languages', 'education'] as const).map(field => ({ [field]: { has: value } })), ...(['reference', 'companyIndustry', 'country', 'region', 'city', 'address', 'contractType'] as const).map(field => ({ [field]: { contains: value, mode: 'insensitive' as const } }))],
    });
    for (const term of (input.keyword ?? '').split(/\s+/).filter(Boolean).slice(0, 12)) and.push(textSearch(term, ['title', 'companyName', 'description']));
    if (input.domain?.trim()) and.push(textSearch(input.domain.trim(), ['title', 'description']));
    if (input.location?.trim()) and.push({ location: { contains: input.location.trim(), mode: 'insensitive' } });
    if (input.company?.trim()) and.push({ companyName: { contains: input.company.trim(), mode: 'insensitive' } });
    if (input.workMode) and.push({ workplaceType: { contains: input.workMode, mode: 'insensitive' } });
    if (input.contractType) and.push({ OR: [{ contractType: { contains: input.contractType, mode: 'insensitive' } }, { contractType: null, employmentType: { contains: input.contractType, mode: 'insensitive' } }] });
    if (input.employmentType) and.push({ employmentType: { contains: input.employmentType.replace('_', ' '), mode: 'insensitive' } });
    if (input.experienceLevel) and.push({ experienceLevel: { contains: input.experienceLevel, mode: 'insensitive' } });
    if (input.skills?.trim()) and.push({ OR: input.skills.split(',').map(skill => skill.trim()).filter(Boolean).flatMap(skill => [
      { skills: { has: skill } }, { description: { contains: skill, mode: 'insensitive' } }, { title: { contains: skill, mode: 'insensitive' } },
    ]) });
    if (input.publishedWithin) and.push({ publishedAt: { gte: new Date(now.getTime() - input.publishedWithin * 24 * 60 * 60 * 1000) } });
    if (input.salaryMin != null) and.push({ salaryMax: { gte: input.salaryMin } });
    if (input.salaryMax != null) and.push({ salaryMin: { lte: input.salaryMax } });
    if (input.currency) and.push({ currency: { equals: input.currency, mode: 'insensitive' } });
    if (input.sourceType) and.push({ sources: { some: { source: { type: input.sourceType } } } });
    return { AND: and };
  }

  private orderBy(sort?: string): Prisma.AggregatedJobOrderByWithRelationInput[] {
    if (sort === 'salaryHigh') return [{ salaryMax: 'desc' }, { publishedAt: 'desc' }];
    if (sort === 'salaryLow') return [{ salaryMin: 'asc' }, { publishedAt: 'desc' }];
    return [{ publishedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
  }

  private async ensureSource(adapter: JobSourceAdapter) {
    const health = await adapter.healthCheck();
    return this.prisma.jobSource.upsert({
      where: { type: adapter.type },
      create: { type: adapter.type, name: adapter.name, enabled: adapter.isConfigured(), syncStatus: health.status },
      update: { name: adapter.name, enabled: adapter.isConfigured(), syncStatus: health.status },
    });
  }

  private async storeListings(sourceId: string, listings: ExternalJobListing[], syncedAt: Date) {
    const stats = { imported: 0, updated: 0, duplicatesMerged: 0, rejected: 0 };
    // Stable source IDs are the primary identity. A changed title must not orphan saved jobs.
    const unique = [...new Map(listings.map(job => [job.id, job])).values()];
    for (const batch of chunks(unique, 25)) {
      await this.prisma.$transaction(async tx => {
        for (const listing of batch) {
          if (!listing.id || !listing.title?.trim() || !httpsUrl(listing.url)) { stats.rejected++; continue; }
          const title = repairKnownCorruption(listing.title).trim();
          const companyName = listing.companyName ? repairKnownCorruption(listing.companyName) : null;
          const description = repairKnownCorruption(listing.description || '');
          const clean = (values?: string[]) => [...new Set((values || []).map(repairKnownCorruption))];
          // Conservative cross-source dedup: unknown employers never merge. Require strong
          // evidence beyond title/company/location; salary, posting day and full body matter.
          const identity = companyName && description.length >= 120
            ? [normalizePart(companyName), normalizePart(title), normalizePart(listing.location || ''), normalizePart(description),
              listing.salaryMin, listing.salaryMax, listing.currency, listing.publishedAt?.toISOString().slice(0, 10), listing.reference]
            : [sourceId, listing.id];
          const dedupeKey = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
          const sourceSnapshot = JSON.parse(JSON.stringify({ ...listing, rawMetadata: undefined }));
          const contentHash = createHash('sha256').update(JSON.stringify(sourceSnapshot)).digest('hex');
          const ref = await tx.aggregatedJobSource.findUnique({ where: { sourceId_sourceJobId: { sourceId, sourceJobId: listing.id } } });
          if (ref?.sourceUpdatedAt && listing.sourceUpdatedAt && listing.sourceUpdatedAt < ref.sourceUpdatedAt) {
            await tx.aggregatedJobSource.update({ where: { id: ref.id }, data: { lastSyncedAt: syncedAt, missingSince: null } });
            continue;
          }
          let existing = ref ? await tx.aggregatedJob.findUnique({ where: { id: ref.aggregatedJobId } })
            : await tx.aggregatedJob.findUnique({ where: { dedupeKey } });
          if (!existing && companyName && description.length >= 250) {
            const candidates = await tx.aggregatedJob.findMany({ where: { companyName: { equals: companyName, mode: 'insensitive' }, title: { equals: title, mode: 'insensitive' } }, take: 20 });
            existing = candidates.find(candidate => sameVacancy(listing, candidate)) || null;
          }
          let status: AggregatedJobStatus = listing.status || 'OPEN';
          if (listing.closingAt && listing.closingAt <= syncedAt) status = 'EXPIRED';
          const website = httpsUrl(listing.companyWebsite);
          const companyIdentity = companyName ? createHash('sha256').update(JSON.stringify([
            website ? new URL(website).hostname.toLowerCase().replace(/^www\./, '') : sourceId,
            normalizePart(companyName), ...(website ? [] : [normalizePart(listing.companyLocation || listing.location || '')]),
          ])).digest('hex') : null;
          const employer = companyIdentity ? await tx.sourceCompany.upsert({ where: { identityKey: companyIdentity },
            create: { identityKey: companyIdentity, name: companyName!, website, logoUrl: httpsUrl(listing.companyLogoUrl), industry: listing.companyIndustry, location: listing.companyLocation },
            update: { name: companyName!, website: website || undefined, logoUrl: httpsUrl(listing.companyLogoUrl) || undefined, industry: listing.companyIndustry || undefined, location: listing.companyLocation || undefined },
          }) : null;
          const data = {
            sourceCompanyId: existing?.companyWebsite && !website ? existing.sourceCompanyId : employer?.id,
            title, companyName: companyName || undefined, companyLogoUrl: httpsUrl(listing.companyLogoUrl) || undefined,
            description: existing && existing.description.length > description.length ? existing.description : description,
            responsibilities: clean(listing.responsibilities).length ? clean(listing.responsibilities) : existing?.responsibilities || [],
            requirements: clean(listing.requirements).length ? clean(listing.requirements) : existing?.requirements || [],
            skills: clean(listing.skills).length ? clean(listing.skills) : existing?.skills || [],
            experienceLevel: listing.experienceLevel || undefined, employmentType: listing.employmentType || undefined,
            workplaceType: listing.workplaceType || undefined, location: listing.location || undefined,
            salaryMin: listing.salaryMin == null ? undefined : Math.round(listing.salaryMin),
            salaryMax: listing.salaryMax == null ? undefined : Math.round(listing.salaryMax),
            salaryText: listing.salaryText || undefined, currency: listing.currency || undefined,
            publishedAt: listing.publishedAt ?? undefined, closingAt: listing.closingAt ?? undefined,
            companyWebsite: httpsUrl(listing.companyWebsite) || undefined, companyIndustry: listing.companyIndustry || undefined,
            companyLocation: listing.companyLocation || undefined, reference: listing.reference || undefined,
            niceToHave: clean(listing.niceToHave).length ? clean(listing.niceToHave) : existing?.niceToHave || [], benefits: clean(listing.benefits).length ? clean(listing.benefits) : existing?.benefits || [], languages: clean(listing.languages).length ? clean(listing.languages) : existing?.languages || [], education: clean(listing.education).length ? clean(listing.education) : existing?.education || [],
            experienceMin: listing.experienceMin ?? undefined, experienceMax: listing.experienceMax ?? undefined,
            contractType: listing.contractType || undefined, contractDuration: listing.contractDuration || undefined,
            country: listing.country || undefined, region: listing.region || undefined, city: listing.city || undefined, address: listing.address || undefined,
            salaryPeriod: listing.salaryPeriod || undefined, positions: listing.positions == null ? undefined : Math.round(listing.positions),
            lastSyncedAt: syncedAt, contentHash,
          };
          // Existing source references determine canonical identity; upsert handles concurrent sources.
          const job = existing ? await tx.aggregatedJob.update({ where: { id: existing.id }, data })
            : await tx.aggregatedJob.upsert({ where: { dedupeKey }, create: { ...data, dedupeKey, status }, update: data });
          const reference = {
            aggregatedJobId: job.id, sourceLabel: listing.sourceLabel, originalUrl: listing.url,
            applicationUrl: httpsUrl(listing.applicationUrl) || listing.url,
            applicationMethod: SourceApplicationMethod.EXTERNAL_APPLICATION,
            sourceUpdatedAt: listing.sourceUpdatedAt, lastSyncedAt: syncedAt, missingSince: null, status, contentHash,
            normalizedData: sourceSnapshot as Prisma.InputJsonValue,
            rawMetadata: JSON.parse(JSON.stringify(listing.rawMetadata || {})) as Prisma.InputJsonValue,
            applicationFields: JSON.parse(JSON.stringify(listing.applicationFields || [])) as Prisma.InputJsonValue,
          };
          await tx.aggregatedJobSource.upsert({ where: { sourceId_sourceJobId: { sourceId, sourceJobId: listing.id } },
            create: { ...reference, sourceId, sourceJobId: listing.id }, update: reference });
          const hasOpenSource = await tx.aggregatedJobSource.count({ where: { aggregatedJobId: job.id, status: 'OPEN' } });
          const canonicalStatus = job.closingAt && job.closingAt <= syncedAt ? 'EXPIRED' : hasOpenSource ? 'OPEN' : status;
          await tx.aggregatedJob.update({ where: { id: job.id }, data: { status: canonicalStatus } });
          if (!existing) stats.imported++;
          else if (!ref) stats.duplicatesMerged++;
          else if (ref.contentHash !== contentHash) stats.updated++;
        }
      }, { timeout: 30_000 });
    }
    return stats;
  }

}

export interface AggregatedSearch {
  items: Array<Prisma.AggregatedJobGetPayload<{ include: typeof JOB_INCLUDE }>>;
  total: number;
  configured: boolean;
  lastSyncedAt: Date | null;
}

export interface SourceSyncResult {
  retryAfterMs?: number;
  type: JobSourceType;
  status: JobSourceStatus;
  imported: number;
  duplicatesMerged: number;
  total: number;
}

export interface JobSourceAdminStatus {
  type: JobSourceType;
  name: string;
  status: JobSourceStatus;
  detail: string | null;
  enabled: boolean;
  lastSyncAt: Date | null;
  listingCount: number;
  activeJobs: number;
  closedJobs: number;
}
