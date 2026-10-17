import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobSourceType } from '@prisma/client';
import { LicensedFeedAdapter } from './licensed-feed.adapter';

@Injectable()
export class LinkedInAdapter extends LicensedFeedAdapter {
  constructor(config: ConfigService) {
    super(config, JobSourceType.LINKEDIN, 'LinkedIn Jobs', 'https://business.linkedin.com/hire/ats-partners/partner-application', 'REQUIRES_PARTNERSHIP', 'Talent Solutions partner approval is required. Job Posting and Apply Connect do not authorize arbitrary catalogue search or candidate submission.');
  }
}
