import { Inject, Injectable } from '@nestjs/common';
import { CONFIG, type AppConfig } from '../config/configuration';
import { CvDocument, CvLocale } from './cv-document';

export type WritingIssue = { id: string; blockId: string; field: string; offset: number; length: number; before: string; replacement: string | null; message: string; category: 'spelling' | 'grammar' | 'punctuation' | 'repetition'; provider: 'languagetool' | 'local' };
type Source = { blockId: string; field: string; text: string };

@Injectable()
export class WritingQualityService {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  private sources(document: CvDocument): Source[] {
    const values: Source[] = [
      { blockId: 'identity-title', field: 'personal.title', text: document.personal.title },
      { blockId: 'identity-extra', field: 'personal.extra', text: document.personal.extra },
    ];
    for (const section of document.sections) for (const entry of section.entries) {
      values.push({ blockId: entry.id, field: `entry:${section.id}:${entry.id}:title`, text: entry.title });
      values.push({ blockId: `${entry.id}-text`, field: `entry:${section.id}:${entry.id}:text`, text: entry.text });
      for (const bullet of entry.bullets) values.push({ blockId: bullet.id, field: `bullet:${section.id}:${entry.id}:${bullet.id}`, text: bullet.text });
    }
    return values.filter(source => source.text.trim());
  }

  async check(document: CvDocument) {
    const sources = this.sources(document), locale = document.locale;
    const remote = this.config.languageTool?.url ? await this.languageTool(sources, locale).catch(() => null) : null;
    const issues = remote ?? sources.flatMap(source => this.local(source, locale));
    return { locale, provider: remote ? 'languagetool' : 'local', issues, dimensions: ['Orthographe', 'Grammaire', 'Clarté', 'Concision', 'Ton professionnel', 'Verbes d’action', 'Répétitions', 'Cohérence des temps', 'Terminologie', 'Ponctuation'] };
  }

  private async languageTool(sources: Source[], locale: CvLocale): Promise<WritingIssue[]> {
    const separator = '\n\n', starts: { source: Source; start: number; end: number }[] = [];
    let text = '';
    for (const source of sources) { const start = text.length; text += `${text ? separator : ''}${source.text}`; const actualStart = start + (start ? separator.length : 0); starts.push({ source, start: actualStart, end: actualStart + source.text.length }); }
    const body = new URLSearchParams({ text, language: locale });
    if (this.config.languageTool?.apiKey) body.set('apiKey', this.config.languageTool.apiKey);
    const response = await fetch(this.config.languageTool!.url!, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(this.config.languageTool!.timeoutMs) });
    if (!response.ok) throw new Error(`LanguageTool ${response.status}`);
    const payload = await response.json() as { matches?: { offset: number; length: number; message: string; replacements?: { value: string }[]; rule?: { issueType?: string; category?: { id?: string } } }[] };
    return (payload.matches ?? []).flatMap((match, index) => {
      const range = starts.find(item => match.offset >= item.start && match.offset + match.length <= item.end);
      if (!range) return [];
      const issue = match.rule?.issueType ?? match.rule?.category?.id ?? '';
      const category: WritingIssue['category'] = /misspell/i.test(issue) ? 'spelling' : /typograph|punct/i.test(issue) ? 'punctuation' : /duplication|repetition/i.test(issue) ? 'repetition' : 'grammar';
      const offset = match.offset - range.start;
      return [{ id: `lt-${index}-${range.source.blockId}`, blockId: range.source.blockId, field: range.source.field, offset, length: match.length, before: range.source.text.slice(offset, offset + match.length), replacement: match.replacements?.[0]?.value ?? null, message: match.message, category, provider: 'languagetool' as const }];
    });
  }

  private local(source: Source, locale: CvLocale): WritingIssue[] {
    const output: WritingIssue[] = [], add = (match: RegExpExecArray, replacement: string, message: string, category: WritingIssue['category']) => output.push({ id: `local-${source.blockId}-${match.index}-${category}`, blockId: source.blockId, field: source.field, offset: match.index, length: match[0].length, before: match[0], replacement, message, category, provider: 'local' });
    const repeated = /\b([\p{L}][\p{L}'’-]{2,})\s+\1\b/giu; let match: RegExpExecArray | null;
    while ((match = repeated.exec(source.text))) add(match, match[1], 'Mot répété', 'repetition');
    const spaces = / {2,}/g; while ((match = spaces.exec(source.text))) add(match, ' ', 'Espaces consécutives', 'punctuation');
    if (locale.startsWith('fr')) {
      const punctuation = /\S([:;!?])/g; while ((match = punctuation.exec(source.text))) add(match, `${match[0][0]}\u00a0${match[1]}`, 'Espace typographique française', 'punctuation');
      const plural = /\b(plusieurs|des)\s+(application|projet|service|outil)\b/gi; while ((match = plural.exec(source.text))) add(match, `${match[1]} ${match[2]}s`, 'Accord au pluriel', 'grammar');
    }
    return output;
  }
}
