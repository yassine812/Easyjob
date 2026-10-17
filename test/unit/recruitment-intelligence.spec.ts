import { jobIntelligence, requirementEvidence } from '../../src/career/recruitment-evidence';
import { applicationQuality } from '../../src/career/application-quality';
import { atsReport } from '../../src/career/career-engine';
import { searchIntent } from '../../src/career/search-intent';

const job = { id: 'job', title: 'Django Developer', description: 'Docker is required. AWS is a plus.', requirements: [], skills: [{ skill: { name: 'Django REST Framework' }, required: true }, { skill: { name: 'PostgreSQL' }, required: false }, { skill: { name: 'Docker' }, required: false }] };
describe('cited recruitment intelligence', () => {
  it('distinguishes partial, transferable, absent and conflicting evidence with verbatim citations', () => {
    const fit = requirementEvidence(job, 'Built with Django\nMySQL\nNo experience with Docker');
    expect(fit.requirements.map(r => r.status)).toEqual(['PARTIALLY_SUPPORTED', 'TRANSFERABLE', 'CONFLICTING']);
    expect(fit.requirements[0].evidence[0]).toEqual({ source: 'CV', path: 'line[1]', quote: 'Built with Django' });
    expect(requirementEvidence(job, 'Python').requirements.every(r => r.status === 'NOT_FOUND')).toBe(true);
  });
  it('normalizes aliases, preserves job priority quotes and excludes protected traits', () => {
    const intelligence = jobIntelligence({ ...job, requirements: ['nationalité française', 'religion catholique'] });
    expect(intelligence.requirements).toHaveLength(3);
    expect(intelligence.requirements[2]).toMatchObject({ priority: 'REQUIRED', source: { quote: 'Docker is required.' } });
    expect(requirementEvidence(job, 'DRF').requirements[0].status).toBe('EXPLICITLY_SUPPORTED');
    expect(requirementEvidence(job, 'Je n’ai jamais utilisé Docker').requirements[2].status).toBe('CONFLICTING');
  });
  it('keeps profile evidence separate from selected CV coverage', () => {
    const fit = requirementEvidence(job, 'Python', 'DRF');
    expect(fit.requirements[0]).toMatchObject({ status: 'EXPLICITLY_SUPPORTED', cvStatus: 'NOT_FOUND', action: 'REFERENCE_PROFILE_EVIDENCE_IN_CV' });
    expect(fit.cvCoverage).toBe(0); expect(fit.score).toBeGreaterThan(0);
    expect(requirementEvidence({ title: 'Developer', skills: [] }, 'Python').score).toBeNull();
  });
  it('derives individual requirements from published prose with source quotes', () => {
    const source = 'Django REST Framework et PostgreSQL requis, 3 ans d’expérience';
    const fit = requirementEvidence({ title: 'Developer', skills: [], requirements: [source] }, 'Django REST Framework\nPostgreSQL\n4 ans d’expérience');
    expect(fit.requirements.every(r => r.source.quote === source)).toBe(true);
    expect(fit.requirements.some(r => r.label === 'django rest framework' && r.status === 'EXPLICITLY_SUPPORTED')).toBe(true);
    expect(fit.requirements.some(r => r.label === '3+ years experience' && r.status === 'EXPLICITLY_SUPPORTED')).toBe(true);
    expect(fit.requirements).toHaveLength(3);
  });
  it('retains compound qualifications and does not turn contract duration into experience', () => {
    const requirements = jobIntelligence({ title: 'Developer', skills: [], requirements: ['Python and a PhD required', 'Contrat de 2 ans'] }).requirements;
    expect(requirements.map(r => r.label)).toContain('Python and a PhD required');
    expect(requirements.map(r => r.label)).not.toContain('2+ years experience');
    expect(requirements.map(r => r.label)).toContain('Contrat de 2 ans');
  });
  it('uses documented experience duration instead of inferring years from seniority', () => {
    const target = { title: 'Developer', skills: [], minimumYearsExperience: 3 };
    expect(requirementEvidence(target, 'Senior Developer').score).toBe(0);
    expect(requirementEvidence(target, '4 years of experience').score).toBe(100);
    expect(requirementEvidence(target, '2 ans d’expérience').requirements[0].status).toBe('PARTIALLY_SUPPORTED');
  });
  it('reports real audit checks with unknown visual layout and no keyword target', () => {
    const report = atsReport('# Candidate\nDeveloper\n## Experience\n• Worked on a Python application.\n## Skills\nPython');
    expect(report.audit.findings.some(f => f.key === 'weak_bullets')).toBe(true);
    expect(report.audit.dimensions.find(d => d.key === 'keyword_coverage')?.score).toBeNull();
    expect(report.audit.documentChecks.every(d => d.status === 'UNKNOWN')).toBe(true);
  });
  it('blocks invalid documents and unanswered employer fields, but not an optional letter or evidence gap', () => {
    const resume = { id: 'cv', mimeType: 'application/pdf', parsedText: '# Candidate\nPython\nc@example.com', processingStatus: 'COMPLETED' };
    const dto = { resumeId: 'cv', candidateSnapshot: { fullName: 'Candidate', email: 'c@example.com' }, consent: true };
    expect(applicationQuality(job, resume, dto, ['cv']).ready).toBe(true);
    expect(applicationQuality(job, { ...resume, mimeType: 'text/markdown' }, dto, ['cv']).ready).toBe(false);
    const required = { ...job, applicationFields: [{ id: 'portfolio', label: 'Portfolio', type: 'url', required: true }] };
    expect(applicationQuality(required, resume, dto, ['cv']).ready).toBe(false);
    expect(applicationQuality(required, resume, { ...dto, answers: { portfolio: 'https://example.com' } }, ['cv']).ready).toBe(true);
  });
  it('recognizes search intent without overwriting explicit filters', () => {
    expect(searchIntent({ keyword: 'junior django developer tunis' }).query).toMatchObject({ keyword: 'django developer', location: 'Tunis', experienceLevel: 'JUNIOR' });
    expect(searchIntent({ keyword: 'remote python jobs', workMode: 'HYBRID' }).query).toMatchObject({ keyword: 'python', workMode: 'HYBRID' });
    expect(searchIntent({ keyword: 'jobs matching my CV' }).matchingCv).toBe(true);
  });
});
