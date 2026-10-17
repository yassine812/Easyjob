import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [join(directory, entry.name)] : []);
}
describe('EasyJob feature identity across roles', () => {
  it('does not reintroduce generic magic icons or AI branding in product features', () => {
    const productFiles = [...files(resolve('src/components/candidate')), ...files(resolve('src/components/company')), ...files(resolve('src/components/shared')), ...files(resolve('src/app/(candidate)')), ...files(resolve('src/app/(company)')), ...files(resolve('src/app/(admin)'))];
    for (const file of productFiles) expect(readFileSync(file, 'utf8'), file).not.toMatch(/\b(?:Sparkles|WandSparkles|Wand2)\b|✦|EasyJob AI|Assistant IA/);
  });
  it('retains functional and entitlement icons beside the feature mark', () => {
    const assistant = readFileSync(resolve('src/components/company/meeting-assistant.tsx'), 'utf8');
    const layout = readFileSync(resolve('src/app/(candidate)/layout.tsx'), 'utf8');
    expect(assistant).toMatch(/Info, ShieldCheck/);
    expect(layout).toContain('Crown'); expect(layout).toContain('Search'); expect(layout).toContain('Video');
    expect(layout).toContain('EasyJobFeatureMark');
  });
});
