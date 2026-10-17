import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '../common/constants/queues';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../files/storage.service';
import { AiClient } from './ai-client';
import { atsReport, extractProfile } from '../career/career-engine';
import { prefillFromCv } from '../career/cv-prefill';
import { Prisma } from '@prisma/client';

@Processor(QUEUES.CV_PROCESSING)
@Injectable()
export class CvProcessor extends WorkerHost {
  private readonly logger = new Logger(CvProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly aiClient: AiClient,
  ) {
    super();
  }

  async process(job: Job<{ resumeId: string }>): Promise<void> {
    const resume = await this.prisma.resume.findUnique({ where: { id: job.data.resumeId } });
    if (!resume) return;
    try {
      await this.prisma.resume.update({ where: { id: resume.id }, data: { processingStatus: 'PROCESSING' } });
      const bytes = await this.storage.getBytes(resume.storageKey);
      let text: string;

      if (resume.parsedText) {
        text = resume.parsedText;
      } else if (resume.mimeType.startsWith('text/')) {
        text = bytes.toString('utf8');
      } else {
        text = await this.aiClient.extractText(resume.filename, bytes);
      }

      if (!text.trim() || text.includes('\u0000')) throw new Error('No readable CV text. Upload a text-based PDF, DOCX or text file.');
      const extracted = extractProfile(text), report = atsReport(text);
      const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
      await this.prisma.$transaction(async tx => {
        await tx.resume.update({ where: { id: resume.id }, data: { parsedText: text.slice(0, 200_000), processingStatus: 'COMPLETED', atsReport: asJson(report), extractedProfile: asJson(extracted) } });
        await prefillFromCv(tx, resume.candidateId, extracted);
      });
      this.logger.log(`CV ${resume.id} processed (${text.length} chars)`);
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`CV processing failed for ${resume.id}: ${message}`);
      await this.prisma.resume.update({
        where: { id: resume.id },
        data: { processingStatus: 'FAILED' },
      });
      throw err;
    }
  }
}
