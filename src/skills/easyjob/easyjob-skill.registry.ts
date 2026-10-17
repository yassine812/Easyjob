import { Injectable } from '@nestjs/common';
import { SkillDefinition } from './easyjob-skills.types';

@Injectable()
export class EasyJobSkillRegistry {
  private readonly skills = new Map<string, SkillDefinition>();

  register(definition: SkillDefinition) {
    if (!/^[a-z0-9-]+$/.test(definition.name)) throw new Error(`Invalid skill name: ${definition.name}`);
    if (!/^\d+\.\d+\.\d+$/.test(definition.version)) throw new Error(`Invalid skill version: ${definition.version}`);
    if (this.skills.has(definition.name)) throw new Error(`Skill already registered: ${definition.name}`);
    this.skills.set(definition.name, definition);
  }

  getSkill(name: string) {
    return this.skills.get(name);
  }

  listSkills() {
    return [...this.skills.values()].map(skill => ({
      name: skill.name,
      version: skill.version,
      purpose: skill.purpose,
      requiredPermissions: skill.requiredPermissions ?? [],
      timeoutMs: skill.timeoutMs ?? 8000,
    }));
  }

  validateSkill(name: string) {
    const definition = this.skills.get(name);
    if (!definition) return { valid: false, errors: [`Unknown skill: ${name}`] };
    return { valid: true, errors: [] as string[] };
  }
}
