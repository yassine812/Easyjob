import type { Job, SkillLevel } from '@/types/api';

export type BuilderSkill = { name: string; level: SkillLevel; required: boolean };
export const normalized = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Remove only exact legacy skill sentences. Other qualifications must survive editing.
export function distinctRequirements(requirements: string[], skills: BuilderSkill[]) {
  const names = new Set(skills.map(skill => normalized(skill.name)));
  return requirements.filter(value => !names.has(normalized(value).replace(/^(maitrise de |proficiency in |knowledge of )/, '').replace(/[.!]$/, '')));
}

export function mergeSkills(skills: BuilderSkill[]): BuilderSkill[] {
  const result = new Map<string, BuilderSkill>();
  for (const skill of skills) {
    const key = normalized(skill.name);
    if (!key) continue;
    const previous = result.get(key);
    result.set(key, previous ? { ...previous, required: previous.required || skill.required } : { ...skill, name: skill.name.trim() });
  }
  return [...result.values()];
}

export function builderSkills(job?: Job): BuilderSkill[] {
  return mergeSkills((job?.skills ?? []).map(item => ({ name: item.skill.name, required: item.required, level: item.level })));
}

// The API stores a readable string, not typed interview objects. Keep legacy text intact.
export function processSteps(value?: string | null): string[] {
  return value ? value.split('\n').map(line => line.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean) : [];
}
export function serializeSteps(steps: string[]): string {
  return steps.map(step => step.trim()).filter(Boolean).map((step, index) => `${index + 1}. ${step}`).join('\n');
}
