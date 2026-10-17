import { Injectable } from '@nestjs/common';
import { EasyJobSkillRegistry } from './easyjob-skill.registry';
import { EasyJobSkillRuntime } from './easyjob-skill.runtime';
import { SkillContext, SkillExecution } from './easyjob-skills.types';

@Injectable()
export class EasyJobSkillsService {
  constructor(private readonly registry: EasyJobSkillRegistry, private readonly runtime: EasyJobSkillRuntime) {}

  getSkill(name: string) { return this.registry.getSkill(name); }
  listSkills() { return this.registry.listSkills(); }
  validateSkill(name: string) { return this.registry.validateSkill(name); }
  execute<T = unknown>(name: string, context: SkillContext): Promise<SkillExecution<T>> { return this.runtime.execute<T>(name, context); }
}
