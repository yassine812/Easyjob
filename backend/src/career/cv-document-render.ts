import { CvDocument, plainInline } from './cv-document';
import { cvTemplateCatalog, templateDefinition } from './cv-template-catalog';

export type CvBlock = { id: string; sectionId?: string; entryId?: string; bulletId?: string; html: string; text: string; keepNext?: boolean; pageBreak?: boolean };
function paragraphs(text: string): string[] {
  const output: string[] = [];
  for (const line of text.split('\n')) {
    let current = '';
    for (const word of line.split(/\s+/).filter(Boolean)) {
      if (current && current.length + word.length > 650) { output.push(current); current = ''; }
      current += `${current ? ' ' : ''}${word}`;
    }
    if (current) output.push(current);
  }
  return output;
}
export const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export function inlineHtml(value: string): string {
  return escapeHtml(value).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1 ($2)</a>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
}
export const templateNames = Object.fromEntries(cvTemplateCatalog.map(template => [template.id, { name: template.name, category: `${template.market === 'INTL' ? 'International' : template.market} · ${template.category}${template.atsFriendly ? ' · ATS' : ''}` }]));
/** The same bounded typography and markup feed preview and server PDF export. */
export function renderDocument(doc: CvDocument, template = 'modern') {
  const blocks: CvBlock[] = [], p = doc.personal;
  const push = (b: CvBlock) => { if (b.text.trim()) blocks.push(b); };
  push({ id: 'identity-name', html: `<h1>${inlineHtml(p.name)}</h1>`, text: plainInline(p.name), keepNext: true });
  push({ id: 'identity-title', html: `<p class="cv-title">${inlineHtml(p.title)}</p>`, text: plainInline(p.title), keepNext: true });
  const contacts = [p.email, p.phone, p.location, p.links].filter(Boolean).join(' · ');
  push({ id: 'identity-contact', html: `<p class="cv-contact">${inlineHtml(contacts)}</p>`, text: plainInline(contacts) });
  p.extra.split('\n').forEach((line, i) => push({ id: `identity-extra-${i}`, html: `<p class="cv-contact">${inlineHtml(line)}</p>`, text: plainInline(line) }));
  for (const s of doc.sections.filter(s => s.visible)) {
    if (!s.entries.some(e => [e.title, e.organization, e.text, e.url, ...e.bullets.map(b => b.text)].some(v => v.trim()))) continue;
    push({ id: s.id, sectionId: s.id, html: `<h2>${inlineHtml(s.title)}</h2>`, text: plainInline(s.title), keepNext: true, pageBreak: s.pageBreak });
    for (const e of s.entries) {
      const ref = { sectionId: s.id, entryId: e.id };
      push({ ...ref, id: e.id, html: `<h3>${inlineHtml(e.title)}</h3>`, text: plainInline(e.title), keepNext: true });
      const meta = [e.organization, e.location, e.period].filter(Boolean).join(' · ');
      push({ ...ref, id: `${e.id}-meta`, html: `<p class="cv-meta">${inlineHtml(meta)}</p>`, text: plainInline(meta), keepNext: true });
      push({ ...ref, id: `${e.id}-url`, html: `<p>${/^https?:\/\//.test(e.url) ? `<a href="${escapeHtml(e.url)}">${escapeHtml(e.url)}</a>` : inlineHtml(e.url)}</p>`, text: e.url });
      paragraphs(e.text).forEach((line, i) => push({ ...ref, id: `${e.id}-text-${i}`, html: `<p>${inlineHtml(line)}</p>`, text: plainInline(line) }));
      for (const b of e.bullets) paragraphs(b.text).forEach((part, index) => push({ ...ref, id: index ? `${b.id}-${index}` : b.id, bulletId: b.id, html: `<p class="cv-bullet">${index ? '' : '• '}${inlineHtml(part)}</p>`, text: `${index ? '' : '• '}${plainInline(part)}` }));
    }
  }
  const style = doc.style, accent = { navy: '#234e68', teal: '#235547', slate: '#344154', plum: '#63435f', brown: '#6c5039' }[style.accent];
  const margin = { compact: 32, standard: 42, wide: 54 }[style.margins];
  const spacing = { compact: 1.2, balanced: 1.38, spacious: 1.55 }[style.spacing];
  const sectionGap = { compact: 11, balanced: 16, spacious: 21 }[style.spacing];
  const css = `body,.cv-page-content{font-family:${style.bodyFont === 'serif' ? 'serif' : 'sans-serif'};font-size:${style.size * .75}pt;color:#263342;line-height:${spacing};overflow-wrap:anywhere} h1,h2,h3,p{padding:0} h1{font-family:${style.headingFont === 'serif' ? 'serif' : 'sans-serif'};font-size:25pt;line-height:1.12;color:${accent};margin:0 0 6pt;text-align:${style.alignment}} h2{font-family:${style.headingFont === 'serif' ? 'serif' : 'sans-serif'};font-size:11pt;color:${accent};margin:${sectionGap}pt 0 7pt;padding:0 0 4pt;${style.headings === 'line' ? `border-bottom:1px solid ${accent}` : style.headings === 'band' ? 'background-color:#f0f3f6;padding:5pt 7pt' : ''}} h3{font-size:${style.size * .8}pt;margin:9pt 0 3pt;font-weight:bold} p{margin:0 0 4pt} .cv-title{font-size:14pt;color:${accent};text-align:${style.alignment}} .cv-contact{font-size:9pt;color:#475569;text-align:${style.alignment}} .cv-meta{font-size:9pt;color:#475569} .cv-bullet{padding-left:10pt;text-indent:-8pt} a{color:${accent};text-decoration:underline}`;
  const layouts: Record<string, string> = {
    clean: 'h1{font-size:24pt} h2{text-transform:uppercase;font-size:10pt;letter-spacing:.45pt}',
    'accent-top': `h1{border-top:5pt solid ${accent};padding-top:13pt}`,
    'section-rail': `h2{letter-spacing:.7pt;text-transform:uppercase;border-left:3pt solid ${accent};padding-left:7pt;border-bottom:0}`,
    centered: 'h1,.cv-title,.cv-contact{text-align:center} h2{text-transform:uppercase;font-size:10pt}',
    executive: `h1{font-size:26pt} .cv-title{border-bottom:3pt solid ${accent};padding-bottom:10pt} h2{text-transform:uppercase;letter-spacing:.6pt}`,
    modern: `h1{font-family:${style.headingFont === 'serif' ? 'serif' : 'sans-serif'};font-size:29pt} h2{background:#f3f6f8;padding:6pt;border-bottom:0}`,
  };
  const definition = templateDefinition(template);
  return { blocks, css: css + layouts[definition.layout], margin, html: blocks.map(b => `<div${b.pageBreak ? ' style="page-break-before:always"' : ''}>${b.html}</div>`).join(''), text: blocks.map(b => b.text).join('\n') };
}
