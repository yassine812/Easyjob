import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobSourceType } from '@prisma/client';
import { LicensedFeedAdapter } from './licensed-feed.adapter';

@Injectable()
export class GlassdoorAdapter extends LicensedFeedAdapter {
  constructor(config: ConfigService) {
    super(config, JobSourceType.GLASSDOOR, 'Glassdoor', 'https://www.glassdoor.com', 'NOT_VERIFIED', 'No current official inbound jobs API contract verified. A licensed jobs feed and redistribution rights are required; review data must not be ingested.');
  }
}
