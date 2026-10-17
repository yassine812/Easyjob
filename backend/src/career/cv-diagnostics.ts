/** Deterministic text signals, kept separate from claims about visual layout or verified performance. */
export const cvWordCount = (text: string) => (text.match(/[\p{L}\p{N}][\p{L}\p{N}+#.]*/gu) ?? []).length;

export function cvExcerpts(lines: string[]): string[] {
  return [...new Set(lines.map(line => line.trim()).filter(Boolean))].slice(0, 3).map(line => line.slice(0, 240));
}

export function cvEmails(text: string): string[] {
  return [...new Set(text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [])];
}

export function cvPhones(text: string): string[] {
  const candidates = text.match(/(?<![\p{L}\p{N}])(?:\+\d{1,3}[ .-]?)?(?:\(?\d{2,4}\)?[ .-]){2,}\d{2,4}(?!\d)|(?<![\p{L}\p{N}])\+?\d{8,15}(?![\p{L}\p{N}])/gu) ?? [];
  return [...new Set(candidates.filter(value => {
    const digits = value.replace(/\D/g, '');
    // A range of years is not a contact number, even when its digit count fits.
    return digits.length >= 8 && digits.length <= 15 && !/^(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}$/.test(value);
  }))];
}

export function quantifiedCvEvidence(text: string, originalText = text) {
  const number = '(?:\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+|\\d+)(?:[.,]\\d+)?';
  const unit = '(?:%|percent(?:age)?|pour\\s+cent|fonctionnalit[ée]s?|features?|axes?|plateformes?|platforms?|applications?|modules?|projets?|projects?|clients?|customers?|users?|utilisateurs?|[ée]crans?|screens?|[ée]quipes?|teams?|collaborateurs?|employees?|personnes?|people|endpoints?|API(?:s)?|heures?|hours?|jours?|days?|minutes?|secondes?|seconds?|[€$£]|EUR|USD|TND|euros?|dollars?|revenus?|revenue|مستخدم(?:ين)?|عميل|عملاء|مشاريع|منصات|ميزات|ساعة|دقائق)';
  const quantitative = new RegExp(`(?<![\\p{L}\\p{N}])${number}\\s*${unit}(?![\\p{L}\\p{N}])`, 'giu');
  const change = /(?:rédui\w*|reduc\w*|réduct\w*|augment\w*|amélior\w*|accélér\w*|diminu\w*|économis\w*|gagn\w*|baisse|hausse|croissance|boost\w*|improv\w*|increas\w*|decreas\w*|sav(?:ed|ing)|cut|grew|growth|faster|خفض|زيادة|تحسين)/iu;
  const outcomeUnit = /(?:%|percent|pour\s+cent|heures?|hours?|jours?|days?|minutes?|secondes?|seconds?|[€$£]|EUR|USD|TND|euros?|dollars?|revenus?|revenue)(?![\p{L}\p{N}])/iu;
  const found: { evidence: string; kind: 'scope' | 'outcome' }[] = [];
  const boundary = /\r?\n[\t ]*\r?\n|\r?\n[\t ]*(?=[-•●▪*]\s)|[.!?]\s/;
  const sourcePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  for (const match of text.matchAll(quantitative)) {
    const index = match.index!;
    // PDF line wraps may split one claim; new bullets, paragraphs and sentences separate claims.
    const before = text.slice(Math.max(0, index - 140), index).split(boundary).pop() || '';
    const after = text.slice(index + match[0].length, index + match[0].length + 80).split(boundary)[0];
    const context = `${before}${match[0]}${after}`;
    // One contiguous quote per claim. Resolve extraction whitespace back to the original
    // source so PDF wraps and indentation remain verbatim without consuming extra slots.
    const source = originalText.match(new RegExp(`(${sourcePattern(before.trimStart())})(${sourcePattern(match[0])})(${sourcePattern(after.trimEnd())})`, 'u'));
    const claimOnly = source ? null : originalText.match(new RegExp(sourcePattern(match[0]), 'u'));
    const verbatim = source?.[0] || claimOnly?.[0] || '';
    const numericOffset = source?.[1].length || 0;
    const start = verbatim.length > 240 ? Math.max(0, numericOffset - 120) : 0;
    const evidence = verbatim.slice(start, start + 240).trim();
    found.push({ evidence, kind: change.test(context) && outcomeUnit.test(match[0]) ? 'outcome' : 'scope' });
  }
  const scopeCount = found.filter(item => item.kind === 'scope').length;
  const outcomeCount = found.length - scopeCount;
  return {
    evidence: cvExcerpts(found.map(item => item.evidence)),
    metrics: { count: found.length, scopeCount, outcomeCount, kind: outcomeCount ? 'outcome' : scopeCount ? 'scope' : 'none' },
  };
}
