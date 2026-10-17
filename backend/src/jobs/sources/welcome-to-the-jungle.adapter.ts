import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobSourceType } from '@prisma/client';
import { LicensedFeedAdapter } from './licensed-feed.adapter';

@Injectable()
export class WelcomeToTheJungleAdapter extends LicensedFeedAdapter {
  constructor(config: ConfigService) {
    super(config, JobSourceType.WELCOME_TO_THE_JUNGLE, 'Welcome to the Jungle', 'https://help.welcometothejungle.com/en/where-to-find-my-org.-ref.-on-welcome-to-the-jungle', 'REQUIRES_PARTNERSHIP', 'Documented integrations are organization-scoped and enabled by the account manager. Full catalogue access is not verified.');
  }
}
