import { Global, Module, OnModuleInit } from '@nestjs/common';
import { ExternalResearchModule } from '../../external-research/external-research.module';
import { EasyJobSkillRegistry } from './easyjob-skill.registry';
import { EasyJobSkillRuntime } from './easyjob-skill.runtime';
import { EasyJobSkillsService } from './easyjob-skills.service';
import { EasyJobSkillHandlers } from './easyjob-skill.handlers';

@Global()
@Module({ imports: [ExternalResearchModule], providers: [EasyJobSkillRegistry, EasyJobSkillRuntime, EasyJobSkillsService, EasyJobSkillHandlers], exports: [EasyJobSkillRegistry, EasyJobSkillRuntime, EasyJobSkillsService] })
export class EasyJobSkillsModule implements OnModuleInit {
  constructor(private readonly registry: EasyJobSkillRegistry, private readonly handlers: EasyJobSkillHandlers) {}
  onModuleInit() { for (const definition of this.handlers.definitions()) this.registry.register(definition); }
}
