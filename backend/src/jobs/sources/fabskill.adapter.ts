import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobSourceType } from '@prisma/client';
import { LicensedFeedAdapter } from './licensed-feed.adapter';

@Injectable()
export class FabskillAdapter extends LicensedFeedAdapter {
  constructor(config: ConfigService) {
    super(config, JobSourceType.FABSKILL, 'Fabskill', 'https://app.fabskill.com/home/api', 'REQUIRES_API_CREDENTIALS', 'Public API overview describes OAuth/API keys, pagination and rate limits. Inbound jobs schema, organization scope and submission rights need provider documentation.');
  }
}
