import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { AutomationTriggerType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../companies/company-access.service';
import { AuditService } from '../audit/audit.service';
import { QUEUES } from '../common/constants/queues';
import { paginate, resolvePagination } from '../common/utils/pagination';
import { toJson } from '../common/utils/json';
import type { AutomationRuleDto } from './dto/automation.dto';
import type { RequestMeta } from '../companies/companies.service';

export interface AutomationEventPayload {
  entityType: string;
  entityId: string;
  companyId: string;
  [key: string]: unknown;
}

@Injectable()
export class AutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CompanyAccessService,
    private readonly audit: AuditService,
    @InjectQueue(QUEUES.AUTOMATION) private readonly queue: Queue,
  ) {}

  // ---------------- rule CRUD ----------------

  async createRule(userId: string, companyId: string, dto: AutomationRuleDto, meta: RequestMeta) {
    await this.access.assertPermission(userId, companyId, 'automation.manage');
    const rule = await this.prisma.automationRule.create({
      data: {
        companyId,
        createdById: userId,
        name: dto.name,
        triggerType: dto.triggerType,
        triggerConfig: toJson(dto.triggerConfig ?? {}),
        conditions: toJson(dto.conditions ?? []),
        actions: toJson(dto.actions),
        active: dto.active ?? true,
      },
    });
    await this.audit.log({
      actorId: userId,
      action: 'automation.rule_created',
      entityType: 'AutomationRule',
      entityId: rule.id,
      metadata: { companyId, triggerType: dto.triggerType },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return rule;
  }

  async listRules(userId: string, companyId: string) {
    await this.access.assertMembership(userId, companyId);
    return this.prisma.automationRule.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRule(userId: string, companyId: string, ruleId: string, dto: Partial<AutomationRuleDto>, meta: RequestMeta) {
    await this.access.assertPermission(userId, companyId, 'automation.manage');
    const rule = await this.prisma.automationRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.companyId !== companyId) throw new NotFoundException('Rule not found');
    const updated = await this.prisma.automationRule.update({
      where: { id: ruleId },
      data: {
        name: dto.name ?? undefined,
        triggerType: dto.triggerType ?? undefined,
        triggerConfig: dto.triggerConfig !== undefined ? toJson(dto.triggerConfig) : undefined,
        conditions: dto.conditions !== undefined ? toJson(dto.conditions) : undefined,
        actions: dto.actions !== undefined ? toJson(dto.actions) : undefined,
        active: dto.active ?? undefined,
      },
    });
    await this.audit.log({
      actorId: userId,
      action: 'automation.rule_updated',
      entityType: 'AutomationRule',
      entityId: ruleId,
      metadata: { companyId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return updated;
  }

  async deleteRule(userId: string, companyId: string, ruleId: string, meta: RequestMeta) {
    await this.access.assertPermission(userId, companyId, 'automation.manage');
    const rule = await this.prisma.automationRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.companyId !== companyId) throw new NotFoundException('Rule not found');
    await this.prisma.automationRule.delete({ where: { id: ruleId } });
    await this.audit.log({
      actorId: userId,
      action: 'automation.rule_deleted',
      entityType: 'AutomationRule',
      entityId: ruleId,
      metadata: { companyId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { success: true };
  }

  async listExecutions(companyId: string, query: { page?: number; limit?: number }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const where = { rule: { companyId } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.automationExecution.findMany({
        where,
        include: { rule: { select: { id: true, name: true, triggerType: true } }, logs: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.automationExecution.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  // ---------------- trigger evaluation ----------------

  @OnEvent('candidate.applied')
  async onCandidateApplied(payload: {
    applicationId: string;
    jobId: string;
    companyId: string;
    candidateId: string;
  }): Promise<void> {
    await this.evaluate(payload.companyId, AutomationTriggerType.CANDIDATE_APPLIED, {
      entityType: 'Application',
      entityId: payload.applicationId,
      companyId: payload.companyId,
      applicationId: payload.applicationId,
      jobId: payload.jobId,
      candidateId: payload.candidateId,
    });
  }

  @OnEvent('application.status_changed')
  async onApplicationStatusChanged(payload: {
    applicationId: string;
    jobId: string;
    companyId: string;
    previousStatus: string;
    newStatus: string;
    actorId: string;
  }): Promise<void> {
    await this.evaluate(payload.companyId, AutomationTriggerType.APPLICATION_STATUS_CHANGED, {
      entityType: 'Application',
      entityId: payload.applicationId,
      companyId: payload.companyId,
      applicationId: payload.applicationId,
      jobId: payload.jobId,
      previousStatus: payload.previousStatus,
      newStatus: payload.newStatus,
      actorId: payload.actorId,
    });
  }

  @OnEvent('interview.scheduled')
  async onInterviewScheduled(payload: {
    interviewId: string;
    applicationId: string;
    jobId: string;
    companyId: string;
    candidateId: string;
  }): Promise<void> {
    await this.evaluate(payload.companyId, AutomationTriggerType.INTERVIEW_SCHEDULED, {
      entityType: 'Interview',
      entityId: payload.interviewId,
      companyId: payload.companyId,
      interviewId: payload.interviewId,
      applicationId: payload.applicationId,
      jobId: payload.jobId,
      candidateId: payload.candidateId,
    });
  }

  @OnEvent('job.expiring')
  async onJobExpiring(payload: { jobId: string; companyId: string; title: string; expiresAt: Date | null }): Promise<void> {
    await this.evaluate(payload.companyId, AutomationTriggerType.JOB_EXPIRING, {
      entityType: 'Job',
      entityId: payload.jobId,
      companyId: payload.companyId,
      jobId: payload.jobId,
      title: payload.title,
      expiresAt: payload.expiresAt?.toISOString(),
    });
  }

  @OnEvent('candidate.match_score_updated')
  async onMatchScoreUpdated(payload: { applicationId: string; jobId: string; companyId: string; overall: number }): Promise<void> {
    await this.evaluate(payload.companyId, AutomationTriggerType.CANDIDATE_MATCH_SCORE_UPDATED, {
      entityType: 'Application',
      entityId: payload.applicationId,
      companyId: payload.companyId,
      applicationId: payload.applicationId,
      jobId: payload.jobId,
      overallMatch: payload.overall,
    });
  }

  async evaluate(companyId: string, triggerType: AutomationTriggerType, payload: AutomationEventPayload): Promise<number> {
    const rules = await this.prisma.automationRule.findMany({
      where: { companyId, triggerType, active: true },
    });
    let enqueued = 0;
    for (const rule of rules) {
      if (!this.matchesTriggerConfig(rule.triggerConfig, payload)) continue;
      if (!this.evaluateConditions(rule.conditions, payload)) continue;
      try {
        const execution = await this.prisma.automationExecution.create({
          data: {
            ruleId: rule.id,
            triggerType,
            entityType: payload.entityType,
            entityId: payload.entityId,
            status: 'PENDING',
          },
        });
        await this.queue.add('execute', { executionId: execution.id }, { delay: 0 });
        enqueued += 1;
      } catch (err) {
        // Unique violation → already executed for this entity (idempotency).
        if ((err as { code?: string }).code !== 'P2002') throw err;
      }
    }
    return enqueued;
  }

  private matchesTriggerConfig(config: Prisma.JsonValue, payload: AutomationEventPayload): boolean {
    if (!config || typeof config !== 'object') return true;
    const cfg = config as Record<string, unknown>;
    for (const [key, value] of Object.entries(cfg)) {
      if (payload[key] !== value) return false;
    }
    return true;
  }

  private evaluateConditions(conditions: Prisma.JsonValue, payload: AutomationEventPayload): boolean {
    if (!Array.isArray(conditions) || conditions.length === 0) return true;
    return conditions.every((cond) => {
      const c = cond as { field: string; op: string; value: unknown };
      const actual = this.getField(payload, c.field);
      switch (c.op) {
        case 'eq':
          return actual === c.value;
        case 'neq':
          return actual !== c.value;
        case 'in':
          return Array.isArray(c.value) && (c.value as unknown[]).includes(actual);
        case 'not_in':
          return Array.isArray(c.value) && !(c.value as unknown[]).includes(actual);
        case 'gt':
          return typeof actual === 'number' && actual > Number(c.value);
        case 'lt':
          return typeof actual === 'number' && actual < Number(c.value);
        case 'contains':
          return typeof actual === 'string' && actual.includes(String(c.value));
        default:
          return false;
      }
    });
  }

  private getField(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, part) => {
      if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
      return undefined;
    }, obj);
  }
}
