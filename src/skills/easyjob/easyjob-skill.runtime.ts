import { ForbiddenException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { CONFIG, AppConfig } from '../../config/configuration';
import { EasyJobSkillRegistry } from './easyjob-skill.registry';
import { SkillContext, SkillExecution } from './easyjob-skills.types';

@Injectable()
export class EasyJobSkillRuntime {
  private readonly logger = new Logger(EasyJobSkillRuntime.name);

  constructor(private readonly registry: EasyJobSkillRegistry, @Optional() @Inject(CONFIG) private readonly config?: AppConfig) {}

  async execute<T = unknown>(name: string, context: SkillContext): Promise<SkillExecution<T>> {
    const definition = this.registry.getSkill(name);
    if (!definition) return { skill: name, version: 'unknown', status: 'FAILED', durationMs: 0, error: `Unknown skill: ${name}` };
    const started = Date.now();
    if (this.config?.skills?.enabled === false) return { skill: name, version: definition.version, status: 'FALLBACK', durationMs: 0, error: 'EasyJob Skills are disabled' };
    const inputErrors = definition.validateInput?.(context.input) ?? [];
    if (inputErrors.length) return { skill: name, version: definition.version, status: 'FAILED', durationMs: Date.now() - started, error: inputErrors.join('; ') };
    const missing = (definition.requiredPermissions ?? []).filter(permission => !context.permissions.includes(permission));
    if (missing.length) throw new ForbiddenException(`Missing skill permission: ${missing.join(', ')}`);
    try {
      const timeoutMs = definition.timeoutMs ?? 8000;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const output = await new Promise<unknown>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Skill timeout')), timeoutMs);
        Promise.resolve(definition.execute(context as never)).then(resolve, reject);
      }).finally(() => { if (timer) clearTimeout(timer); });
      const outputErrors = definition.validateOutput?.(output) ?? [];
      if (outputErrors.length) throw new Error(outputErrors.join('; '));
      return { skill: name, version: definition.version, status: 'COMPLETED', durationMs: Date.now() - started, output: output as T };
    } catch (error) {
      if (definition.fallback) {
        try {
          const output = await definition.fallback(context as never, error);
          return { skill: name, version: definition.version, status: 'FALLBACK', durationMs: Date.now() - started, output: output as T };
        } catch (fallbackError) {
          error = fallbackError;
        }
      }
      const message = error instanceof Error ? error.message : 'Skill execution failed';
      this.logger.warn(`${name}@${definition.version} failed: ${message}`);
      return { skill: name, version: definition.version, status: 'FAILED', durationMs: Date.now() - started, error: message };
    }
  }
}
