import { answerInterview, blankDocument, documentText, importDocument, newSection, nextInterviewQuestion, normalizeImportedDocument, relabelDocument, validateDocument } from '../../src/career/cv-document';
import { renderDocument } from '../../src/career/cv-document-render';
import { cvTemplateCatalog } from '../../src/career/cv-template-catalog';

describe('Structured CV document', () => {
  it('retains imported source facts and creates stable IDs after persistence', () => {
    const source = 'Candidate Example\nDéveloppeur\nexample@example.test\nPROFIL PROFESSIONNEL\nDéveloppement web.\nEXPÉRIENCE PROFESSIONNELLE\nDéveloppeur 2022 - 2024\nEntreprise Example\n• Création de services API\nFORMATION\nLicence informatique';
    const doc = importDocument(source), saved = validateDocument(JSON.parse(JSON.stringify(doc)));
    expect(saved).toEqual(doc); expect(saved.importReview).toBe(true);
    expect(documentText(doc)).toContain('Entreprise Example'); expect(documentText(doc)).toContain('Création de services API');
    expect(doc.sections.find(s => s.type === 'experience')?.entries[0].title).toBe('Développeur 2022 - 2024');
  });
  it('maps confident imported contacts into canonical fields without duplicating them', () => {
    const source = 'Yassine Zerni\nDéveloppeur Full-Stack\nzerniyassine21@gmail.com | +216 93 171 337 | Tunis, Tunisie | linkedin.com/in/yassine-zerni\nPROFIL PROFESSIONNEL\nDéveloppement web.';
    const doc = importDocument(source);
    expect(doc.personal).toEqual(expect.objectContaining({ email: 'zerniyassine21@gmail.com', phone: '+216 93 171 337', location: 'Tunis, Tunisie', links: 'linkedin.com/in/yassine-zerni', extra: '' }));
    expect(doc.importConfidence).toEqual(expect.objectContaining({ email: 'high', phone: 'high', location: 'high', links: 'high' }));
    expect(documentText(doc).match(/zerniyassine21@gmail\.com/g)).toHaveLength(1);
  });
  it('repairs legacy imports while retaining ambiguous text for review', () => {
    const doc = blankDocument(); doc.personal.name = 'Yassine Zerni'; doc.personal.extra = 'zerniyassine21@gmail.com\nExpérience : 5 ans de développement logiciel à Tunis.\nDisponible immédiatement selon mobilité'; doc.importReview = true;
    const repaired = normalizeImportedDocument(doc, '').document;
    expect(repaired.personal.email).toBe('zerniyassine21@gmail.com');
    expect(repaired.personal.location).toBe('');
    expect(repaired.personal.extra).toContain('Expérience : 5 ans de développement logiciel à Tunis.');
    expect(repaired.personal.extra).toContain('Disponible immédiatement selon mobilité');
    expect(repaired.importReview).toBe(true);
  });
  it('rejects duplicate IDs, malformed fields and arbitrary style values', () => {
    const doc = blankDocument(); doc.sections = [newSection('experience')];
    doc.sections.push(structuredClone(doc.sections[0])); expect(() => validateDocument(doc)).toThrow('Identifiants');
    doc.sections.pop(); (doc.style as unknown as { size: number }).size = 70; expect(() => validateDocument(doc)).toThrow('Style');
  });
  it('hides sections without destroying their data and escapes hostile markup', () => {
    const doc = blankDocument(); doc.personal.name = '<script>alert(1)</script>'; const section = newSection('projects'); section.entries[0].text = 'A real project'; doc.sections.push(section);
    expect(renderDocument(doc).html).not.toContain('<script>'); expect(renderDocument(doc).html).toContain('&lt;script&gt;');
    section.visible = false; expect(documentText(doc)).not.toContain('A real project'); expect(doc.sections[0].entries[0].text).toBe('A real project');
  });
  it('switches templates without changing facts and emits safe live/PDF markup', () => {
    const doc = blankDocument(); doc.personal.name = 'Example Candidate'; const section = newSection('summary'); section.entries[0].text = '**Django** and [portfolio](https://example.test)'; doc.sections.push(section);
    const before = JSON.stringify(doc), classic = renderDocument(doc, 'classic'), modern = renderDocument(doc, 'modern');
    expect(classic.text).toBe(modern.text); expect(classic.css).not.toBe(modern.css); expect(classic.html).toContain('<b>Django</b>'); expect(classic.html).toContain('href="https://example.test"'); expect(JSON.stringify(doc)).toBe(before);
  });
  it('provides purposeful market templates and changes labels without changing candidate facts', () => {
    expect(cvTemplateCatalog).toHaveLength(10); expect(cvTemplateCatalog.every(template => template.sectionDefaults.length && template.supportedLocales.length)).toBe(true);
    const doc = blankDocument(); doc.personal.name = 'Yassine Zerni'; doc.sections = [newSection('experience')]; doc.sections[0].entries[0].organization = 'EasyJob'; doc.sections[0].entries[0].period = '2024 – Aujourd’hui';
    const english = relabelDocument(doc, 'en-CA');
    expect(english.sections[0].title).toBe('Work Experience'); expect(english.sections[0].entries[0].period).toContain('Present'); expect(english.personal.name).toBe('Yassine Zerni'); expect(english.sections[0].entries[0].organization).toBe('EasyJob'); expect(doc.locale).toBe('fr-FR');
  });
  it('adapts the interview to candidates without experience and persists corrections', () => {
    let doc = blankDocument();
    for (const answer of ['Example', 'Développeur junior', 'example@example.test', 'Tunis', '', '']) doc = answerInterview(doc, nextInterviewQuestion(doc)!, answer);
    expect(nextInterviewQuestion(doc)?.key).toBe('education.title');
    doc = answerInterview(doc, nextInterviewQuestion(doc)!, ''); expect(nextInterviewQuestion(doc)?.key).toBe('projects.text');
    const q = nextInterviewQuestion(doc)!; doc = answerInterview(doc, q, 'Projet Django'); const id = doc.sections[0].id;
    doc = answerInterview(doc, q, 'Projet React'); expect(doc.sections[0].id).toBe(id); expect(documentText(doc)).toContain('Projet React'); expect(documentText(doc)).not.toContain('Projet Django');
    const order = doc.interview.map(a => a.key);
    doc = answerInterview(doc, { key: 'name', question: 'Nom ?' }, 'Corrected Example');
    expect(doc.interview.map(a => a.key)).toEqual(order);
    expect(doc.personal.name).toBe('Corrected Example');
  });
  it('collects another experience without overwriting the first', () => {
    let doc = blankDocument();
    for (const answer of ['Example', 'Developer', 'example@example.test', 'Tunis', '', 'oui', 'Backend', 'A company', '2020–2021', 'Django API', 'API livrée', 'oui', 'Frontend']) doc = answerInterview(doc, nextInterviewQuestion(doc)!, answer);
    const entries = doc.sections.find(s => s.type === 'experience')!.entries;
    expect(entries).toHaveLength(2); expect(entries[0].title).toBe('Backend'); expect(entries[1].title).toBe('Frontend'); expect(entries[0].id).not.toBe(entries[1].id);
  });
});
