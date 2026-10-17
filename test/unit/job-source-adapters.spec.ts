import { ConfigService } from '@nestjs/config';
import { JobSourceType } from '@prisma/client';
import { AnetiAdapter, normalizeAnetiListings } from '../../src/jobs/sources/aneti.adapter';
import { AnetiInternationalAdapter, normalizeAnetiInternationalListings } from '../../src/jobs/sources/aneti-international.adapter';
import { LinkedInAdapter } from '../../src/jobs/sources/linkedin.adapter';
import { TanitJobsAdapter } from '../../src/jobs/sources/tanitjobs.adapter';
import { decodeSourceBuffer, fetchPublicHtml, normalizeSourceUrl, repairKnownCorruption } from '../../src/jobs/sources/public-html';

describe('public job source adapters', () => {
  it('normalizes public ANETI offer rows and keeps only verified ANETI links', () => {
    const html = `<table><tr class="emp"><td>123</td><td><a href="global.php?page=994&amp;menu1=&amp;bureau=1210&amp;annee=2026&amp;numoffre=2349&amp;cpt=1&amp;fin=3168">Développeur Full Stack</a></td><td>Informatique</td><td>Tunis</td><td>1</td><td>18/09/2026</td><td>Bac + 3</td><td>Informatique</td></tr>
      <tr class="emp"><td>456</td><td><a href="https://evil.example/job">Fake listing</a></td></tr></table>`;
    const jobs = normalizeAnetiListings(html);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toEqual(expect.objectContaining({
      id: 'aneti-1210-2026-2349',
      title: 'Développeur Full Stack',
      location: 'Tunis, Tunisie',
      description: 'Informatique',
      url: 'https://www.emploi.nat.tn/fo/Fr2026/global.php?page=994&menu1=&bureau=1210&annee=2026&numoffre=2349&cpt=1&fin=3168',
      requirements: ['Bac + 3', 'Informatique'],
    }));
  });

  it('normalizes international ANETI offers with country and source date', () => {
    const html = `<div class="views-row"><div class="views-field views-field-title"><a href="/node/1032696">Waiter / Serveur</a></div>
      <div class="views-field views-field-company-name"></div><div class="views-field views-field-changed">Publié: Mar 08/09/2026 - 10:24</div>
      <div class="views-field views-field-changed">Date Fin : </div><div>ARABIE SAOUDITE</div></div>`;
    const jobs = normalizeAnetiInternationalListings(html);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toEqual(expect.objectContaining({
      id: 'aneti-international-1032696',
      title: 'Waiter / Serveur',
      location: 'ARABIE SAOUDITE',
      publishedAt: new Date('2026-09-08T00:00:00.000Z'),
      url: 'https://www.aneti-international.tn/node/1032696',
    }));
  });

  it('reports unavailable integrations without making unauthorised source requests', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch');
    const adapters = [new TanitJobsAdapter(new ConfigService({})), new LinkedInAdapter(new ConfigService({}))];

    expect(adapters.map(adapter => adapter.type)).toEqual([JobSourceType.TANITJOBS, JobSourceType.LINKEDIN]);
    await expect(adapters[0].healthCheck()).resolves.toEqual(expect.objectContaining({ status: 'PARTNER_REQUIRED' }));
    await expect(adapters[1].healthCheck()).resolves.toEqual(expect.objectContaining({ status: 'PARTNER_REQUIRED' }));
    await Promise.all(adapters.map(adapter => expect(adapter.fetchJobs()).rejects.toThrow('SOURCE_NOT_CONFIGURED')));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refreshes public job sources once every 24 hours', () => {
    const daily = 24 * 60 * 60 * 1000;
    expect(new AnetiAdapter().syncIntervalMs).toBe(daily);
    expect(new AnetiInternationalAdapter().syncIntervalMs).toBe(daily);
  });

  it('limits public HTML fetches to HTTPS on the expected source host', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch');
    await expect(fetchPublicHtml(new URL('http://www.emploi.nat.tn/offres'), 'www.emploi.nat.tn')).rejects.toThrow('Public source host is not allowed');
    await expect(fetchPublicHtml(new URL('https://evil.example/offres'), 'www.emploi.nat.tn')).rejects.toThrow('Public source host is not allowed');
    expect(normalizeSourceUrl('http://www.emploi.nat.tn/job', 'https://www.emploi.nat.tn/', 'www.emploi.nat.tn')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('decodes UTF-8 and Windows-1252 source pages without mojibake', () => {
    const utf8 = new TextEncoder().encode('<h1>Opérateur d’assemblage — équipe à Tunis</h1>').buffer;
    expect(decodeSourceBuffer(utf8, 'text/html; charset=utf-8')).toContain('Opérateur d’assemblage');
    const latin = Uint8Array.from([60, 104, 49, 62, 79, 112, 233, 114, 97, 116, 101, 117, 114, 32, 100, 39, 97, 115, 115, 101, 109, 98, 108, 97, 103, 101, 60, 47, 104, 49, 62]).buffer;
    expect(decodeSourceBuffer(latin, 'text/html; charset=windows-1252')).toContain('Opérateur');
    expect(repairKnownCorruption('Op\uFFFDrateur')).toBe('Opérateur');
    expect(repairKnownCorruption('Op\uFFFDrateur d\uFFFDassemblage et d\uFFFDemballage manuel')).toBe('Opérateur d’assemblage et d’emballage manuel');
  });
});
