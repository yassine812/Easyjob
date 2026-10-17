import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApecAdapter } from './apec.adapter';
import { GlassdoorAdapter } from './glassdoor.adapter';
import { WelcomeToTheJungleAdapter } from './welcome-to-the-jungle.adapter';
import { TanitJobsAdapter } from './tanitjobs.adapter';
import { IndeedAdapter } from './indeed.adapter';
import { LinkedInAdapter } from './linkedin.adapter';
import { FabskillAdapter } from './fabskill.adapter';
import { JobReviewAdapter } from './jobreview.adapter';
import { EmploitunisieAdapter } from './emploitunisie.adapter';
import { OptioncarriereAdapter } from './optioncarriere.adapter';
import { KeejobAdapter } from './keejob.adapter';
export const PARTNER_ADAPTERS = [ApecAdapter, GlassdoorAdapter, WelcomeToTheJungleAdapter, TanitJobsAdapter, IndeedAdapter, LinkedInAdapter, FabskillAdapter, JobReviewAdapter, EmploitunisieAdapter, OptioncarriereAdapter, KeejobAdapter];
@Injectable()
export class PartnerSourceRegistry {
  readonly adapters;
  constructor(config: ConfigService) { this.adapters = PARTNER_ADAPTERS.map(Adapter => new Adapter(config)); }
}
