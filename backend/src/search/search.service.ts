import { publicJobSalary } from '../jobs/job-content';
import { availableJobWhere } from '../jobs/job-availability';
import { Injectable } from '@nestjs/common';
import { EmploymentType, ExperienceLevel, JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, resolvePagination } from '../common/utils/pagination';

export interface JobSearchQuery {
  keyword?: string;
  location?: string;
  remote?: boolean;
  employmentType?: EmploymentType;
  experienceLevel?: ExperienceLevel;
  salaryMin?: number;
  salaryMax?: number;
  skills?: string[];
  companySlug?: string;
  status?: JobStatus;
  sort?: 'relevance' | 'newest' | 'salaryHigh' | 'salaryLow' | 'title';
  page?: number;
  limit?: number;
}

const JOB_SEARCH_SELECT = {
  id: true,
  companyId: true,
  title: true,
  slug: true,
  description: true,
  location: true,
  remote: true,
  employmentType: true,
  experienceLevel: true,
  salaryVisible: true,
  salaryMin: true,
  salaryMax: true,
  currency: true,
  status: true,
  expiresAt: true,
  publishedAt: true,
  createdAt: true,
  company: { select: { id: true, commercialName: true, slug: true, logoKey: true } },
  skills: { include: { skill: true } },
} satisfies Prisma.JobSelect;

/**
 * Search abstraction. Currently implemented on PostgreSQL (ILike + optional
 * full-text search on the jobs tsvector column). The interface is intentionally
 * provider-agnostic so an OpenSearch/Elasticsearch implementation can replace
 * this without touching controllers or DTOs.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchJobs(query: JobSearchQuery) {
    const { page, limit, skip, take } = resolvePagination(query);

    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query);
    const include = JOB_SEARCH_SELECT;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        select: include,
        orderBy,
        skip,
        take,
      }),
      this.prisma.job.count({ where }),
    ]);

    return paginate(items.map(publicJobSalary), total, page, limit);
  }

  /**
   * Full-text search on the jobs tsvector column (PostgreSQL). Used when the
   * caller explicitly requests relevance ordering with a keyword.
   */
  async searchJobsFts(keyword: string, query: Omit<JobSearchQuery, 'keyword' | 'sort'>) {
    const { page, limit, skip, take } = resolvePagination(query);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT j.id FROM "Job" j
      WHERE j."searchVector" @@ websearch_to_tsquery('english', ${keyword})
      ORDER BY ts_rank(j."searchVector", websearch_to_tsquery('english', ${keyword})) DESC
    `;
    const ids = rows.map(r => r.id);
    const items = ids.length ? await this.prisma.job.findMany({
      where: { AND: [this.buildWhere(query), { id: { in: ids } }] }, select: JOB_SEARCH_SELECT,
    }) : [];
    const ranks = new Map(ids.map((id, index) => [id, index]));
    items.sort((a, b) => ranks.get(a.id)! - ranks.get(b.id)!);
    return paginate(items.slice(skip, skip + take).map(publicJobSalary), items.length, page, limit);
  }
  private buildWhere(query: JobSearchQuery): Prisma.JobWhereInput {
    const keyword = query.keyword?.trim();
    return {
      AND: [availableJobWhere()],
      ...(query.status ? { status: query.status } : { status: JobStatus.PUBLISHED }),
      ...(keyword
        ? {
            OR: [
              { title: { contains: keyword, mode: 'insensitive' } },
              { description: { contains: keyword, mode: 'insensitive' } },
              { location: { contains: keyword, mode: 'insensitive' } },
              { requirements: { hasSome: [keyword] } },
              { responsibilities: { hasSome: [keyword] } },
            ],
          }
        : {}),
      ...(query.location ? { location: { contains: query.location, mode: 'insensitive' } } : {}),
      ...(query.remote !== undefined ? { remote: query.remote } : {}),
      ...(query.employmentType ? { employmentType: query.employmentType } : {}),
      ...(query.experienceLevel ? { experienceLevel: query.experienceLevel } : {}),
      ...((query.salaryMin !== undefined || query.salaryMax !== undefined) ? { salaryVisible: true } : {}),
      ...(query.salaryMin !== undefined ? { salaryMax: { gte: query.salaryMin } } : {}),
      ...(query.salaryMax !== undefined ? { salaryMin: { lte: query.salaryMax } } : {}),
      ...(query.skills && query.skills.length > 0
        ? {
            skills: {
              some: {
                skill: { normalizedName: { in: query.skills.map((s) => s.toLowerCase()) } },
              },
            },
          }
        : {}),
      ...(query.companySlug ? { company: { slug: query.companySlug } } : {}),
    };
  }

  private buildOrderBy(query: JobSearchQuery): Prisma.JobOrderByWithRelationInput[] {
    switch (query.sort) {
      case 'salaryHigh':
        return [{ salaryMin: 'desc' }, { createdAt: 'desc' }];
      case 'salaryLow':
        return [{ salaryMin: 'asc' }, { createdAt: 'desc' }];
      case 'title':
        return [{ title: 'asc' }];
      case 'relevance':
        return [{ createdAt: 'desc' }];
      case 'newest':
      default:
        return [{ createdAt: 'desc' }];
    }
  }
}

