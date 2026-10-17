import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobSourceType } from '@prisma/client';
import { LicensedFeedAdapter } from './licensed-feed.adapter';

@Injectable()
export class ApecAdapter extends LicensedFeedAdapter {
  constructor(config: ConfigService) {
    super(config, JobSourceType.APEC, 'APEC', 'https://corporate.apec.fr/devenir-partenaire', 'REQUIRES_PARTNERSHIP', 'APEC offers partner XML exports under an agreement. Endpoint, XML schema, distribution rights and credentials must be supplied by APEC.');
  }
}
