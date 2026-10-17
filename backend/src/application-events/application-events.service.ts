import { Injectable } from '@nestjs/common';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface EventInput {
  applicationId: string;
  actorId?: string | null;
  previousStatus?: ApplicationStatus | null;
  newStatus: ApplicationStatus;
  metadata?: Prisma.InputJsonValue;
}

/**
 * All application status changes produce an ApplicationEvent row. Events are
 * written from within the same transaction as the status update (see
 * ApplicationsService) and exposed here for history reads.
 */
@Injectable()
export class ApplicationEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: EventInput): Promise<unknown> {
    return this.prisma.applicationEvent.create({
      data: {
        applicationId: input.applicationId,
        actorId: input.actorId ?? null,
        previousStatus: input.previousStatus ?? null,
        newStatus: input.newStatus,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  }

  async listForApplication(applicationId: string) {
    return this.prisma.applicationEvent.findMany({
      where: { applicationId },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
