import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { htmlText } from './public-html';
import { SourceRequestError } from './licensed-feed.adapter';
import type { ExternalJobListing } from './job-source.types';

export const SOFRECOM_ORIGIN = 'https://portail-recrutement.sofrecom.tn';
export const SOFRECOM_LIST = `${SOFRECOM_ORIGIN}/PortailSofrecom/public/display/list-offers`;
export interface SofrecomRow { id: string; title: string; city: string; url: string }

export function sofrecomRows(html: string): SofrecomRow[] {
  const table = html.match(/<table\b[^>]*id=["']myTable["'][^>]*>([\s\S]*?)<\/table>/i)?.[1];
  const body = table?.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1];
  if (body == null) throw new SourceRequestError('SOFRECOM_LIST_FORMAT_CHANGED');
  const rows: SofrecomRow[] = [];
  for (const row of body.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => htmlText(m[1]));
    const id = cells[1];
    const path = row.match(/href=["'](\/PortailSofrecom\/public\/resource\/download-offer\/SOFTU\d+)["']/i)?.[1];
    if (!/^SOFTU\d+$/.test(id || '') || !cells[0] || !/^(Tunis|Sfax)(\s*\/\s*(Tunis|Sfax))?$/i.test(cells[2] || '') || path?.split('/').pop() !== id) {
      throw new SourceRequestError('SOFRECOM_INVALID_ROW');
    }
    rows.push({ id, title: cells[0], city: cells[2], url: SOFRECOM_ORIGIN + path });
  }
  if (new Set(rows.map(r => r.id)).size !== rows.length) throw new SourceRequestError('SOFRECOM_DUPLICATE_ROW');
  return rows;
}

/** PDF/Word utilities ship inside the Linux API/worker image; no desktop app is needed. */
export async function extractOfferDocument(buffer: Buffer): Promise<string> {
  const legacyWord = buffer.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1';
  if (legacyWord && (buffer.includes(Buffer.from('EncryptedPackage', 'utf16le')) || buffer.includes(Buffer.from('Microsoft Rights Label')))) {
    throw new SourceRequestError('SOFRECOM_PROTECTED_DOCUMENT');
  }
  if (legacyWord || buffer.subarray(0, 2).toString() === 'PK') {
    const directory = await mkdtemp(join(tmpdir(), 'easyjob-offer-'));
    try {
      const file = join(directory, legacyWord ? 'offer.doc' : 'offer.docx');
      await writeFile(file, buffer);
      const output = await new Promise<string>((resolve, reject) => execFile(legacyWord ? 'antiword' : 'unzip',
        legacyWord ? ['-m', 'UTF-8.txt', file] : ['-p', file, 'word/document.xml'],
        { timeout: 15000, maxBuffer: 2_000_000, encoding: 'utf8' }, (error, stdout) => error ? reject(new SourceRequestError('SOFRECOM_WORD_EXTRACTION_FAILED')) : resolve(stdout)));
      const text = legacyWord ? output.replace(/\u0000/g, '').trim() : htmlText(output.replace(/<\/w:p>/g, '</p>').replace(/<w:tab\b[^>]*\/>/g, ' '));
      if (text.length < 80) throw new SourceRequestError('SOFRECOM_EMPTY_DOCUMENT');
      return text;
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
  if (buffer.subarray(0, 5).toString() !== '%PDF-') throw new SourceRequestError('SOFRECOM_UNSUPPORTED_DOCUMENT');
  return new Promise((resolve, reject) => {
    const child = execFile('pdftotext', ['-layout', '-', '-'], { timeout: 15000, maxBuffer: 2_000_000, encoding: 'utf8' }, (error, stdout) => {
      if (error) return reject(new SourceRequestError('SOFRECOM_PDF_EXTRACTION_FAILED'));
      const text = stdout.replace(/\u0000/g, '').trim();
      if (text.length < 80) return reject(new SourceRequestError('SOFRECOM_EMPTY_PDF'));
      resolve(text);
    });
    child.stdin?.on('error', () => { /* exit callback reports parser failure */ });
    child.stdin?.end(buffer);
  });
}

export function sofrecomJob(row: SofrecomRow, description: string): ExternalJobListing {
  return { id: `sofrecom:${row.id}`, title: row.title, description, companyName: 'Sofrecom Tunisie',
    companyWebsite: 'https://www.sofrecom.com', companyIndustry: 'Télécommunications et services numériques',
    companyLocation: 'Tunisie', location: `${row.city}, Tunisie`, city: row.city, country: 'TN',
    url: row.url, applicationUrl: SOFRECOM_LIST, sourceLabel: 'Sofrecom · Carrières officielles',
    sourceUpdatedAt: null, publishedAt: null, closingAt: null, salaryText: null, employmentType: null,
    reference: row.id, status: 'OPEN',
    rawMetadata: { employer: 'Sofrecom', method: 'public-employer-list-and-document', originalUrl: row.url, fetchedAt: new Date().toISOString() } };
}
