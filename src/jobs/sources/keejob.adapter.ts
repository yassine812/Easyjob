import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobSourceType } from '@prisma/client';
import { LicensedFeedAdapter } from './licensed-feed.adapter';

@Injectable()
export class KeejobAdapter extends LicensedFeedAdapter {
  constructor(config: ConfigService) {
    super(config, JobSourceType.KEEJOB, 'Keejob', 'https://www.keejob.com/', 'NOT_VERIFIED', 'Public offer pages exist, but no official inbound API schema or submission contract is verified. Partner feed permission is required.');
  }
}
