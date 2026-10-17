import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobSourceType } from '@prisma/client';
import { LicensedFeedAdapter } from './licensed-feed.adapter';

@Injectable()
export class EmploitunisieAdapter extends LicensedFeedAdapter {
  constructor(config: ConfigService) {
    super(config, JobSourceType.EMPLOITUNISIE, 'Emploitunisie', 'https://www.emploitunisie.com/recrutement', 'NOT_VERIFIED', 'Recruiter publishing is public; no official inbound API or authorized application submission contract verified.');
  }
}
