/** Conservative segmentation: preserve unknown text and dates exactly as supplied. */
export interface CvExperience {
  title: string;
  company: string;
  period: string;
  description: string[];
}
export interface CvEducation {
  degree: string;
  field: string;
  institution: string;
  location: string;
  period: string;
  current: boolean;
}
export interface CvLanguage { name: string; level: string; }
export interface CvCertification { name: string; issuer?: string; period?: string; }
const month = '(?:jan(?:vier|uary)?|f[ée]v(?:rier)?|feb(?:ruary)?|mars|march|avr(?:il)?|apr(?:il)?|mai|may|juin|june|juil(?:let)?|july|ao[uû]t|aug(?:ust)?|sept(?:embre|ember)?|oct(?:obre|ober)?|nov(?:embre|ember)?|d[ée]c(?:embre)?|dec(?:ember)?)';
const date = `(?:${month}\\.?\\s+)?(?:19|20)\\d{2}(?:[-/]\\d{2}(?:[-/]\\d{2})?)?|\\d{1,2}[/.-](?:19|20)\\d{2}`;
const periodPattern = new RegExp(`(?:${date})\\s*(?:[-–—]|to|à|au)\\s*(?:(?:${date})|pr[ée]sent|present|actuel(?:lement)?|current|now|aujourd['’]hui|حتى الآن)`, 'i');
const bullet = /^\s*[-•●▪*]\s+/;

export function splitCvExperiences(lines: string[]): CvExperience[] {
  const entries: CvExperience[] = [];
  let current: CvExperience | undefined;
  let explicit = false;
  let pending: string[] = [];
  const flushPending = () => {
    if (pending.length) entries.push({ title: '', company: '', period: '', description: pending });
    pending = [];
  };
  for (const source of lines) {
    const line = source.trim();
    if (!line) continue;
    // Explicit labels are also the lossless format used by the review editor.
    const label = line.match(/^(Poste|Title|Entreprise|Company|Période|Period)\s*:\s*(.*)$/i);
    if (label) {
      const key = /^(Poste|Title)$/i.test(label[1]) ? 'title' : /^(Entreprise|Company)$/i.test(label[1]) ? 'company' : 'period';
      if (key === 'title' || !current) { flushPending(); current = { title: '', company: '', period: '', description: [] }; entries.push(current); }
      current[key] = label[2];
      explicit = true;
      continue;
    }
    const match = !explicit && !bullet.test(line) && line.match(periodPattern);
    if (match) {
      const title = line.slice(0, match.index).replace(/[\s|–—-]+$/, '');
      const after = line.slice((match.index ?? 0) + match[0].length).replace(/^[\s|–—-]+/, '');
      // Common PDF layout: title and company precede the dates on separate lines.
      let preceding: string[] = [];
      if (!title && !current) { preceding = pending; pending = []; }
      else if (!title && current?.description.length) {
        const last = current.description[current.description.length - 1];
        if (!bullet.test(last) && current.description.length > 1 && bullet.test(current.description[current.description.length - 2])) preceding = [current.description.pop()!];
      }
      flushPending();
      current = { title: title || preceding.shift() || '', company: after || preceding.shift() || '', period: match[0], description: preceding };
      entries.push(current);
      continue;
    }
    if (!current) { pending.push(line); continue; }
    if (!explicit && !current.company && !current.description.length && !bullet.test(line)) current.company = line;
    else current.description.push(line);
  }
  flushPending();
  return entries;
}

export function cvSkillItems(lines: string[]): string[] {
  const groups: string[] = [];
  let category = false;
  for (const line of lines) {
    const labelled = /^[^:：]{1,50}[:：]\s*/.test(line);
    if (category && !labelled && !/^[-•●]\s/.test(line)) groups[groups.length - 1] += ` ${line.trim()}`;
    else groups.push(line);
    category = labelled || (category && !/^[-•●]\s/.test(line));
  }
  return [...new Set(groups.flatMap(line => line.replace(/^[-•●]\s*/, '').replace(/^[^:：]{1,50}[:：]\s*/, '').split(/[,;|،·•]/)).map(s => s.trim()).filter(Boolean))];
}

/** Parse education entries while preserving the wording found in the CV. */
export function splitCvEducations(lines: string[]): CvEducation[] {
  const entries: CvEducation[] = [];
  const singleDatePattern = new RegExp(`(?:${month}\\.?\\s+)?(?:19|20)\\d{2}`, 'i');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim(); if (!line) continue;
    const match = line.match(periodPattern) || line.match(singleDatePattern);
    if (!match) continue;
    const degree = line.slice(0, match.index).replace(/[\s|–—-]+$/, '').trim();
    const period = match[0].trim();
    const institution = (lines[i + 1] || '').trim().replace(/^[-•●▪*]\s+/, '');
    if (!degree && !institution) continue;
    const [first, ...rest] = degree.split(/\s+en\s+/i);
    entries.push({ degree: first?.trim() || degree, field: rest.join(' en ').trim(), institution, location: '', period,
      current: /présent|present|actuel|current|now/i.test(period) });
    if (institution) i += 1;
  }
  return entries;
}

/** Parse `Langues:` lines such as `Arabe - Langue maternelle · Français - B1`. */
export function splitCvLanguages(lines: string[]): CvLanguage[] {
  const values = lines.filter(line => !/^Points? forts?\s*[:：]/i.test(line)).flatMap(line => {
    const value = line.replace(/^Langues?\s*[:：]\s*/i, '');
    return value.split(/[·•|;,]+/);
  });
  return values.map(value => value.trim()).filter(Boolean).filter(v => !/^points? forts?/i.test(v)).map(value => {
    const [name, ...rest] = value.split(/\s*[-–—:]\s*/);
    return { name: name.trim(), level: rest.join(' - ').trim() || 'Non précisé' };
  }).filter(item => item.name.length > 1);
}

export function splitCvCertifications(lines: string[]): CvCertification[] {
  return lines.flatMap(line => line.replace(/^Certifications?\s*[:：]\s*/i, '').split(/\r?\n|[·•|;,]+/))
    .map(name => name.trim()).filter(Boolean).map(name => ({ name }));
}
