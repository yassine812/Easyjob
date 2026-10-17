import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobSourceType } from '@prisma/client';
import { LicensedFeedAdapter } from './licensed-feed.adapter';

@Injectable()
export class IndeedAdapter extends LicensedFeedAdapter {
  constructor(config: ConfigService) {
    super(config, JobSourceType.INDEED, 'Indeed', 'https://docs.indeed.com/job-sync-api/', 'REQUIRES_PARTNERSHIP', 'Partner Job Sync is employer-scoped posting and lifecycle management. It is not unrestricted job search. Approved partner access and a catalogue contract are required.');
  }
}
