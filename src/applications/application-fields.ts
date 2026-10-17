import { BadRequestException } from '@nestjs/common';
import type { ApplicationField } from '../jobs/sources/job-source.types';

export function validateApplicationAnswers(schema: unknown, answers: Record<string, unknown> = {}, ownedFileIds: string[] = []) {
  if (!Array.isArray(schema)) throw new BadRequestException('Invalid application form configuration');
  const errors: Record<string, string> = {};
  for (const field of schema as ApplicationField[]) {
    if (!field.id || !field.type) throw new BadRequestException('Invalid application form configuration');
    const value = answers[field.id];
    const empty = value == null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length);
    if (empty) { if (field.required) errors[field.id] = 'Ce champ est obligatoire.'; continue; }
    let valid = false;
    switch (field.type) {
      case 'text': case 'textarea': valid = typeof value === 'string' && value.length <= 12000; break;
      case 'email': valid = typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; break;
      case 'phone': valid = typeof value === 'string' && /^[+()\d\s.-]{6,40}$/.test(value); break;
      case 'url': try { valid = typeof value === 'string' && ['http:', 'https:'].includes(new URL(value).protocol); } catch { valid = false; } break;
      case 'boolean': valid = typeof value === 'boolean'; break;
      case 'number': valid = typeof value === 'number' && Number.isFinite(value); break;
      case 'date': valid = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; break;
      case 'select': valid = typeof value === 'string' && !!field.options?.includes(value); break;
      case 'multiselect': valid = Array.isArray(value) && value.every(v => typeof v === 'string' && field.options?.includes(v)); break;
      case 'file': valid = typeof value === 'string' && ownedFileIds.includes(value); break;
      default: errors[field.id] = 'Ce type de question nécessite une configuration.'; continue;
    }
    if (!valid) errors[field.id] = 'Vérifiez la valeur de ce champ.';
  }
  const allowedIds = new Set((schema as ApplicationField[]).map(field => field.id));
  for (const key of Object.keys(answers)) if (!allowedIds.has(key)) errors[key] = 'Question inconnue.';
  if (Object.keys(errors).length) throw new BadRequestException({ message: 'Vérifiez les réponses obligatoires.', fieldErrors: errors });
}
