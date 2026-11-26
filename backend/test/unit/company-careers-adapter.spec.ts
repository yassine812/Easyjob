import { ConfigService } from '@nestjs/config';
import { CompanyCareersAdapter, EMPLOYERS, eyLinks, normalizeEyJob, normalizeSmartRecruitersJob } from '../../src/jobs/sources/company-careers.adapter';
import { sofrecomRows, sofrecomJob, extractOfferDocument } from '../../src/jobs/sources/sofrecom-careers';

const employer = { key: 'Devoteam', name: 'Devoteam', website: 'https://www.devoteam.com' } as const;
const eyUrl = 'https://careers.ey.com/ey/job/Consultant/12345/';
const eyHtml = `<meta itemprop="streetAddress" content="TN"><meta itemprop="datePosted" content="2026-10-20">
  <meta itemprop="validThrough" content="2020-01-01"><span itemprop="title">Consultant &amp; Data</span>
  <span itemprop="description"><span class="jobdescription"><p>Travail en <span>équipe</span>.</p><p>Analyse et conseil.</p></span></span>`;
const posting = () => ({ id: '12345', name: 'Data Engineer', location: { country: 'tn', city: 'Tunis', hybrid: true },
  active: true, visibility: 'PUBLIC', releasedDate: '2026-10-20', postingUrl: 'https://jobs.smartrecruiters.com/Devoteam/12345-data-engineer',
  jobAd: { sections: { jobDescription: { text: '<p>Construire les pipelines.</p>' }, qualifications: { text: 'SQL et Python' } } } });

describe('official Tunisian employer collection', () => {
  afterEach(() => jest.restoreAllMocks());
  it('keeps only employer links with Tunisia location and deduplicates mobile/desktop links', () => {
    const row = (location: string, href: string) => `<tr class="data-row"><a href="${href}">Job</a><a href="${href}">Job</a><span class="jobLocation">${location}</span></tr>`;
    expect(eyLinks(row('TN', eyUrl) + row('Paris, FR', '/ey/job/Paris/444/') + row('TN', 'https://evil.example/ey/job/X/555/'))).toEqual([eyUrl]);
  });
  it('extracts complete nested EY descriptions, real dates, and expiry', () => {
    const job = normalizeEyJob(eyHtml, eyUrl)!;
    expect(job.title).toBe('Consultant & Data');
    expect(job.description).toContain('Analyse et conseil.');
    expect(job.status).toBe('EXPIRED');
    expect(job.country).toBe('TN');
    expect(job.salaryText).toBeNull();
  });
  it('rejects an unrelated geography and incomplete job templates', () => {
    expect(normalizeEyJob(eyHtml.replace('content="TN"', 'content="FR"'), eyUrl)).toBeNull();
    expect(normalizeEyJob('<html>Job removed</html>', eyUrl)).toBeNull();
  });
  it('preserves public ATS location, work mode and source URL without invented salary', () => {
    expect(normalizeSmartRecruitersJob(posting(), employer)).toMatchObject({ companyName: 'Devoteam', country: 'TN', workplaceType: 'HYBRID', status: 'OPEN', salaryText: null });
  });
  it.each([{ visibility: 'INTERNAL' }, { location: { country: 'fr' } }, { postingUrl: 'https://evil.example/job' }, { active: undefined }])('rejects unsafe or unverified ATS posting %j', (override) => {
    expect(normalizeSmartRecruitersJob({ ...posting(), ...override }, employer)).toBeNull();
  });
  it('preserves explicit closure', () => {
    expect(normalizeSmartRecruitersJob({ ...posting(), active: false }, employer)?.status).toBe('CLOSED');
  });
  it('does not turn one employer outage into a complete snapshot or discard other employers', async () => {
    const adapter = new CompanyCareersAdapter(new ConfigService());
    jest.spyOn(adapter as any, 'collectEy').mockResolvedValue({ jobs: [normalizeEyJob(eyHtml, eyUrl)], complete: true, total: 1 });
    jest.spyOn(adapter as any, 'collectSmartRecruiters').mockRejectedValue(new Error('timeout'));
    jest.spyOn(adapter as any, 'request').mockRejectedValue(new Error('blocked'));
    const result = await adapter.fetchJobs();
    expect(result.jobs).toHaveLength(1);
    expect(result.complete).toBe(false);
    expect(result.warnings?.length).toBe(EMPLOYERS.length + 2);
    expect(result.completedScopes).toEqual([{ prefix: 'ey:', presentIds: ['ey:12345'] }]);
    expect(adapter.reports.find(r => r.employer === 'ADP')?.status).toBe('BLOCKED');
  });
  it('fails if all implemented employers fail; never treats it as an empty valid catalogue', async () => {
    const adapter = new CompanyCareersAdapter(new ConfigService());
    jest.spyOn(adapter as any, 'collectEy').mockRejectedValue(new Error('timeout'));
    jest.spyOn(adapter as any, 'collectSmartRecruiters').mockRejectedValue(new Error('timeout'));
    jest.spyOn(adapter as any, 'request').mockRejectedValue(new Error('blocked'));
    await expect(adapter.fetchJobs()).rejects.toThrow('COMPANY_ALL_SOURCES_FAILED');
  });
  it('supports an explicit operator opt-out', async () => {
    const adapter = new CompanyCareersAdapter(new ConfigService({ JOB_SOURCE_COMPANY_DIRECT_ENABLED: 'false' }));
    expect(adapter.isConfigured()).toBe(false);
    await expect(adapter.fetchJobs()).rejects.toThrow('COMPANY_SOURCE_DISABLED');
  });
  it('treats verified empty employer lists as complete without reconciling failed employers', async () => {
    const adapter = new CompanyCareersAdapter(new ConfigService());
    jest.spyOn(adapter as any, 'collectEy').mockResolvedValue({ jobs: [], complete: true });
    jest.spyOn(adapter as any, 'collectSofrecom').mockRejectedValue(new Error('invalid document'));
    jest.spyOn(adapter as any, 'collectSmartRecruiters').mockResolvedValue({ jobs: [], complete: true });
    jest.spyOn(adapter as any, 'request').mockRejectedValue(new Error('blocked'));
    const result = await adapter.fetchJobs();
    expect(result.completedScopes).toContainEqual({ prefix: 'ey:', presentIds: [] });
    expect(result.completedScopes).toContainEqual({ prefix: 'sr:LEONI1:', presentIds: [] });
    expect(result.completedScopes?.some(scope => scope.prefix === 'sofrecom:')).toBe(false);
  });
  it('does not accept a different posting whose id starts with the requested id', () => {
    expect(normalizeSmartRecruitersJob({ ...posting(), postingUrl: 'https://jobs.smartrecruiters.com/Devoteam/123456-other' }, employer)).toBeNull();
  });
  it('accepts a public ATS alias only after independently verifying the canonical posting', async () => {
    const adapter = new CompanyCareersAdapter(new ConfigService());
    const canonical = { ...posting(), refNumber: 'REF42' };
    jest.spyOn(adapter as any, 'request').mockImplementation(async (url: unknown) => JSON.stringify(
      String(url).includes('?') ? { content: [{ id: '999', location: { country: 'tn' } }], totalFound: 1, offset: 0 }
        : String(url).endsWith('/999') ? { ...canonical, id: '999' } : canonical));
    const result = await (adapter as any).collectSmartRecruiters(employer);
    expect(result).toMatchObject({ complete: true, rejected: 0 });
    expect(result.jobs[0]).toMatchObject({ id: 'sr:Devoteam:999', url: canonical.postingUrl });
  });
  it('rejects an ATS alias whose canonical description belongs to another vacancy', async () => {
    const adapter = new CompanyCareersAdapter(new ConfigService());
    const canonical = { ...posting(), refNumber: 'REF42' };
    jest.spyOn(adapter as any, 'request').mockImplementation(async (url: unknown) => JSON.stringify(
      String(url).includes('?') ? { content: [{ id: '999', location: { country: 'tn' } }], totalFound: 1, offset: 0 }
        : String(url).endsWith('/999') ? { ...canonical, id: '999', name: 'Another vacancy' } : canonical));
    expect(await (adapter as any).collectSmartRecruiters(employer)).toMatchObject({ jobs: [], rejected: 1 });
  });
});

describe('Sofrecom public employer board', () => {
  const row = '<tr><td>Ingénieur Réseaux</td><td>SOFTU123</td><td>Sfax</td><td><a href="/PortailSofrecom/public/resource/download-offer/SOFTU123">Fiche</a></td></tr>';
  const page = (content: string) => `<table id="myTable"><tbody>${content}</tbody></table>`;
  it('preserves the title, city and original reference with an external application handoff', () => {
    const rows = sofrecomRows(page(row));
    expect(rows).toHaveLength(1);
    expect(sofrecomRows(page(row.replace('Sfax', 'Tunis/Sfax')))[0].city).toBe('Tunis/Sfax');
    expect(sofrecomJob(rows[0], 'Description officielle')).toMatchObject({ id: 'sofrecom:SOFTU123', city: 'Sfax', country: 'TN', salaryText: null, publishedAt: null });
  });
  it('only accepts a structurally valid empty board', () => {
    expect(sofrecomRows(page(''))).toEqual([]);
    expect(() => sofrecomRows('<html>Maintenance</html>')).toThrow('SOFRECOM_LIST_FORMAT_CHANGED');
  });
  it('rejects mismatched IDs, unsupported locations and duplicate rows', () => {
    expect(() => sofrecomRows(page(row.replace('download-offer/SOFTU123', 'download-offer/SOFTU456')))).toThrow();
    expect(() => sofrecomRows(page(row.replace('Sfax', 'Paris')))).toThrow();
    expect(() => sofrecomRows(page(row + row))).toThrow('SOFRECOM_DUPLICATE_ROW');
  });
  it('rejects an HTML error page served instead of a job document', async () => {
    await expect(extractOfferDocument(Buffer.from('<html>Login required</html>'))).rejects.toThrow('SOFRECOM_UNSUPPORTED_DOCUMENT');
  });
  it('recognizes protected Word attachments without attempting to decrypt them', async () => {
    const document = Buffer.concat([Buffer.from('d0cf11e0a1b11ae1', 'hex'), Buffer.from('EncryptedPackage', 'utf16le')]);
    await expect(extractOfferDocument(document)).rejects.toThrow('SOFRECOM_PROTECTED_DOCUMENT');
  });
  it('indexes only public metadata when the attached document is protected', async () => {
    const adapter = new CompanyCareersAdapter(new ConfigService());
    jest.spyOn(adapter as any, 'request').mockResolvedValue(page(row));
    jest.spyOn(adapter as any, 'requestBuffer').mockResolvedValue(Buffer.concat([
      Buffer.from('d0cf11e0a1b11ae1', 'hex'), Buffer.from('EncryptedPackage', 'utf16le')]));
    const result = await (adapter as any).collectSofrecom();
    expect(result).toMatchObject({ complete: true, rejected: 0, warnings: ['PROTECTED_DOCUMENTS:1'] });
    expect(result.jobs[0]).toMatchObject({ title: 'Ingénieur Réseaux', city: 'Sfax', rawMetadata: { descriptionStatus: 'PROTECTED_DOCUMENT' } });
    expect(result.jobs[0].description).toContain('n’est pas accessible publiquement');
    jest.restoreAllMocks();
  });
});
