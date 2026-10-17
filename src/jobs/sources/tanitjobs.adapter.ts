import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobSourceType } from '@prisma/client';
import { LicensedFeedAdapter } from './licensed-feed.adapter';

@Injectable()
export class TanitJobsAdapter extends LicensedFeedAdapter {
  constructor(config: ConfigService) {
    super(config, JobSourceType.TANITJOBS, 'TanitJobs', 'https://www.tanitjobs.com/aide-recruteur/api-integrations/', 'REQUIRES_SUBSCRIPTION', 'Recruiter API publishes own vacancies and retrieves applicants. It does not document a general inbound catalogue. Obtain a licensed feed.');
  }
}
