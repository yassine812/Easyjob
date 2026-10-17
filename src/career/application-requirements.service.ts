import { Injectable } from '@nestjs/common';
import type { ApplicationField } from '../jobs/sources/job-source.types';
import { JobMarketplaceService } from './job-marketplace.service';

const STANDARD_FIELD_IDS = new Set(['full_name', 'fullname', 'name', 'email', 'email_address', 'phone', 'telephone', 'location', 'professional_title', 'headline', 'portfolio', 'linkedin', 'github']);
const COVER_LETTER_IDS = new Set(['cover_letter', 'coverletter', 'motivation', 'motivation_letter']);

@Injectable()
export class ApplicationRequirementsService {
  constructor(private readonly marketplace: JobMarketplaceService) {}

  async getRequirements(userId: string, jobId: string) {
    const job = await this.marketplace.getJob(userId, jobId);
    const fields = (Array.isArray(job.applicationFields) ? job.applicationFields : []) as unknown as ApplicationField[];
    const normalized = (id: string) => id.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const standardFields = fields.filter(field => STANDARD_FIELD_IDS.has(normalized(field.id)));
    const questions = fields.filter(field => !STANDARD_FIELD_IDS.has(normalized(field.id)) && !COVER_LETTER_IDS.has(normalized(field.id)));
    const coverLetterRequired = fields.some(field => COVER_LETTER_IDS.has(normalized(field.id)) && field.required);
    const applicationCapability = job.isExternal ? job.applicationMethod === 'EXTERNAL_APPLICATION' ? 'EXTERNAL_ONLY' : 'UNKNOWN' : 'NATIVE_EASY_APPLY';
    return {
      job: { id: job.id, title: job.title, location: job.location, employmentType: job.employmentType, isExternal: !!job.isExternal },
      company: job.company ? { id: job.company.id, name: job.company.commercialName, website: job.company.website || null } : null,
      applicationCapability,
      steps: { information: true, cv: true, questions: questions.length > 0, coverLetter: true, verification: true },
      fields: standardFields,
      questions,
      requiredDocuments: [{ type: 'CV', required: true, acceptedMimeTypes: ['application/pdf'] }],
      coverLetterRequired,
    };
  }
}
