import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobSourceType } from '@prisma/client';
import { LicensedFeedAdapter } from './licensed-feed.adapter';

@Injectable()
export class JobReviewAdapter extends LicensedFeedAdapter {
  constructor(config: ConfigService) {
    super(config, JobSourceType.JOBREVIEW, 'JobReview', 'https://www.jobreview.tn', 'NOT_VERIFIED', 'Provider identity, canonical URL and official jobs integration contract are not verified. Do not activate until the source owner confirms them.');
  }
}
