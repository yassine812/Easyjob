import { presentInterviewBrief } from './question-reason';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../companies/company-access.service';
import { analyzeDeterministicInterview, selectDeterministicQuestions } from '../career/deterministic-interview';
import { toJson } from '../common/utils/json';
import { ExternalResearchService } from '../external-research/external-research.service';
import { EasyJobSkillsService } from '../skills/easyjob/easyjob-skills.service';

const ROLE_QUESTIONS: Record<string, string[]> = {
  HR: ['Qu’est-ce qui vous motive dans ce poste ?', 'Décris une collaboration professionnelle dont tu es fier.', 'Quelles sont tes disponibilités et attentes pour ce rôle ?'],
  TECHNICAL: ['Décris une décision technique importante et les compromis évalués.', 'Comment diagnostiques-tu un problème en production ?', 'Comment vérifies-tu qu’une solution est fiable avant sa livraison ?'],
  FINAL: ['Comment prends-tu la responsabilité d’un résultat de bout en bout ?', 'Qu’attends-tu de l’équipe et de ton manager ?', 'Quelle décision aimerais-tu approfondir avant de nous rejoindre ?'],
};

function pdfText(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '');
}

function pdfEscape(value: string) {
  return pdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildBriefPdf(lines: string[]) {
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += 44) chunks.push(lines.slice(i, i + 44));
  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  const pageIds = chunks.map((_, index) => 4 + index * 2);
  objects.push(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  for (const [index, chunk] of chunks.entries()) {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const stream = ['BT', '/F1 11 Tf', '50 790 Td', ...chunk.flatMap((line, lineIndex) => [lineIndex === 0 ? `(${pdfEscape(line)}) Tj` : '0 -16 Td', lineIndex === 0 ? '' : `(${pdfEscape(line)}) Tj`]).filter(Boolean), 'ET'].join('\n');
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId - 1] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
  }
  let output = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(output, 'latin1'));
    output += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output, 'latin1');
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, 'latin1');
}

@Injectable()
export class InterviewBriefService {
  constructor(private readonly prisma: PrismaService, private readonly access: CompanyAccessService, @Optional() private readonly externalResearch?: ExternalResearchService, @Optional() private readonly skills?: EasyJobSkillsService) {}

  private async load(interviewId: string) {
    const item = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        brief: { include: { questions: { orderBy: { order: 'asc' } } } },
        application: {
          include: {
            job: { include: { skills: { include: { skill: true } }, company: true } },
            candidate: { include: { user: true } },
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Interview not found');
    return item as any;
  }

  private async assertRecruiter(userId: string, item: any) {
    if (item.application.candidate.userId === userId) throw new ForbiddenException('Interview brief is private to the recruiting team');
    await this.access.assertInterviewPermission(userId, item.application.job.companyId, item.id, 'application.view');
  }

  async generate(interviewId: string, userId?: string, locale = 'fr') {
    const item = await this.load(interviewId);
    if (userId) await this.assertRecruiter(userId, item);
    const job = item.application.job;
    const researchInput = { userId: 'system', interviewId, locale: locale as 'fr' | 'en' | 'ar', permissions: ['company.research'], input: { interviewId, companyName: job.company.commercialName, website: job.company.website, title: job.title, technologies: job.skills?.map((row: any) => row.skill?.name).filter(Boolean) } };
    if (this.skills) void this.skills.execute('company-public-context', researchInput).catch(() => undefined);
    else void this.externalResearch?.enqueueInterviewContext(researchInput.input as any).catch(() => undefined);
    const cvText = item.application.cvTextSnapshot ?? '';
    const analysis = analyzeDeterministicInterview(job, cvText, locale, interviewId);
    const skillBrief = this.skills ? await this.skills.execute('interview-brief', { userId: userId ?? 'system', interviewId, locale: locale as 'fr' | 'en' | 'ar', permissions: ['application.view'], input: { interviewId, job, cvText } }) : null;
    const strengths = analysis.evidence.filter((entry) => entry.status === 'strong').slice(0, 8);
    const gaps = analysis.topics.slice(0, 8);
    const selected = selectDeterministicQuestions(analysis, locale, 10, interviewId);
    const fallback = ROLE_QUESTIONS[item.type] ?? ROLE_QUESTIONS.HR;
    const skillQuestions = Array.isArray((skillBrief?.output as any)?.questions) ? (skillBrief?.output as any).questions.map((question: any) => question.text).filter(Boolean) : [];
    const questionTexts = [...skillQuestions, ...selected, ...fallback].filter((question, index, all) => all.indexOf(question) === index).slice(0, 12);
    const topicByQuestion = new Map(analysis.topics.flatMap(topic => topic.questions.map(question => [question, topic] as const)));
    const questions = questionTexts.map((question, index) => {
      const topic = topicByQuestion.get(question);
      const proof = analysis.evidence.find(entry => entry.concept === topic?.concept);
      const requirement = analysis.requirements.find(entry => entry.concept === topic?.concept);
      return {
        question,
        category: topic ? (topic.status === 'missing' ? 'GAP' : topic.status === 'strong' ? 'STRENGTH' : 'VERIFY') : 'ROLE',
        skill: topic?.label ?? null,
        priority: topic?.priority && topic.priority > 0.75 ? 'HIGH' : index < 4 ? 'MEDIUM' : 'OPTIONAL',
        sourceType: topic ? 'JOB_CV_EVIDENCE' : 'INTERVIEW_TYPE',
        sourceReference: topic?.label ?? item.type,
        rationale: topic?.reason ?? `Question selected for the ${item.type.toLowerCase()} interview.`,
        evidence: { ...(topic ? { status: topic.status, score: topic.evidenceScore } : {}), reason: {
          reason_type: !topic ? 'GENERAL' : topic.status === 'missing' ? 'MISSING_EVIDENCE' : topic.status === 'strong' ? 'STRONG_EVIDENCE' : 'WEAK_EVIDENCE',
          ...(topic ? { skill: topic.label, requirement_importance: requirement?.importance ?? 'UNKNOWN' } : {}),
          evidence_count: proof?.evidence.length ?? 0,
          source_types: topic ? ['JOB', 'CV'] : ['INTERVIEW'],
          excerpts: proof?.evidence.map(text => ({ source: 'CV', text })) ?? [],
        } },
        order: index,
      };
    });
    const common = {
      candidateSnapshot: toJson({ name: item.application.candidate.user.name, applicationId: item.applicationId, coverLetter: item.application.coverLetter }),
      jobSnapshot: toJson({ id: job.id, title: job.title, description: job.description, requirements: job.requirements, responsibilities: job.responsibilities, skills: job.skills?.map((row: any) => ({ name: row.skill?.name, required: row.required })) ?? [] }),
      analysisSnapshot: toJson({ method: analysis.method, score: analysis.score, type: item.type }),
      jobAnalysisVersion: 'deterministic-job-v1',
      candidateAnalysisVersion: analysis.method,
      strengths: toJson(strengths),
      gaps: toJson(gaps),
    };
    if (!item.brief) {
      return this.prisma.interviewBrief.create({
        data: {
          interviewId,
          ...common,
          checklist: toJson({ cvViewed: false, jobViewed: false, questionsPrepared: true, notesAdded: false }),
          questions: { create: questions },
        },
      }).then(brief => this.prisma.interviewBrief.findUnique({ where: { id: brief.id }, include: { questions: { orderBy: { order: 'asc' } } } })).then(presentInterviewBrief);
    }
    const preserved = item.brief.questions.filter((question: any) => question.sourceType === 'RECRUITER' || question.recruiterNote || question.covered);
    const generated = questions.map((question, index) => ({ ...question, order: preserved.length + index, briefId: item.brief.id }));
    await this.prisma.$transaction(async tx => {
      await tx.interviewBrief.update({ where: { id: item.brief.id }, data: { ...common, version: { increment: 1 } } });
      await tx.interviewQuestion.deleteMany({ where: preserved.length ? { briefId: item.brief.id, id: { notIn: preserved.map((question: any) => question.id) } } : { briefId: item.brief.id } });
      for (const [index, question] of preserved.entries()) await tx.interviewQuestion.update({ where: { id: question.id }, data: { order: index } });
      if (generated.length) await tx.interviewQuestion.createMany({ data: generated });
    });
    return presentInterviewBrief(await this.prisma.interviewBrief.findUnique({ where: { id: item.brief.id }, include: { questions: { orderBy: { order: 'asc' } } } }));
  }

  async get(userId: string, interviewId: string, locale = 'fr') {
    const item = await this.load(interviewId);
    await this.assertRecruiter(userId, item);
    return presentInterviewBrief(item.brief ?? await this.generate(interviewId, userId, locale));
  }

  async researchContext(userId: string, interviewId: string) {
    const item = await this.load(interviewId);
    await this.assertRecruiter(userId, item);
    const job = item.application.job;
    const result = await this.externalResearch?.getCachedInterviewContext({ interviewId, companyName: job.company.commercialName, website: job.company.website, title: job.title, technologies: job.skills?.map((row: any) => row.skill?.name).filter(Boolean) });
    return result ?? { status: 'DISABLED', sources: [], technologies: [] };
  }

  async refreshResearchContext(userId: string, interviewId: string) {
    const item = await this.load(interviewId);
    await this.assertRecruiter(userId, item);
    const job = item.application.job;
    return this.externalResearch?.enqueueInterviewContext({ interviewId, companyName: job.company.commercialName, website: job.company.website, title: job.title, technologies: job.skills?.map((row: any) => row.skill?.name).filter(Boolean) }) ?? { status: 'DISABLED' as const };
  }

  async updateQuestion(userId: string, interviewId: string, questionId: string, data: { question?: string; order?: number; priority?: string; recruiterNote?: string; covered?: boolean }) {
    const item = await this.load(interviewId);
    await this.assertRecruiter(userId, item);
    if (!item.brief) throw new BadRequestException('Interview brief is not ready');
    return this.prisma.interviewQuestion.update({ where: { id: questionId, briefId: item.brief.id }, data: { ...data, ...(data.priority ? { priority: data.priority.toUpperCase() } : {}) } });
  }

  async addQuestion(userId: string, interviewId: string, question: string) {
    const item = await this.load(interviewId);
    await this.assertRecruiter(userId, item);
    if (!item.brief) throw new BadRequestException('Interview brief is not ready');
    const order = item.brief.questions.length;
    return this.prisma.interviewQuestion.create({ data: { briefId: item.brief.id, question: question.trim(), category: 'CUSTOM', sourceType: 'RECRUITER', sourceReference: 'Recruiter', rationale: 'Added by the recruiter.', priority: 'OPTIONAL', order } });
  }

  async deleteQuestion(userId: string, interviewId: string, questionId: string) {
    const item = await this.load(interviewId);
    await this.assertRecruiter(userId, item);
    if (!item.brief) throw new BadRequestException('Interview brief is not ready');
    return this.prisma.interviewQuestion.delete({ where: { id: questionId, briefId: item.brief.id } });
  }

  async pdf(userId: string, interviewId: string) {
    const item = await this.load(interviewId);
    await this.assertRecruiter(userId, item);
    const brief = item.brief ?? await this.generate(interviewId, userId);
    const candidate = (brief?.candidateSnapshot as any)?.name ?? item.application.candidate.user.name;
    const job = (brief?.jobSnapshot as any)?.title ?? item.application.job.title;
    const analysis = (brief?.analysisSnapshot as any) ?? {};
    const strengths = Array.isArray(brief?.strengths) ? brief.strengths : [];
    const gaps = Array.isArray(brief?.gaps) ? brief.gaps : [];
    const lines = [
      'EasyJob - Dossier d entretien', '', `Candidat: ${candidate}`, `Poste: ${job}`, `Entretien: ${item.startAt.toISOString()}`, `Version: ${brief?.version ?? 1}`, `Compatibilite: ${analysis.score == null ? 'Non determinee' : `${Math.round(Number(analysis.score) * 100)}%`}`, '', 'Points forts', ...strengths.map((entry: any) => `- ${entry.label ?? entry.concept ?? entry}`), '', 'Points a verifier', ...gaps.map((entry: any) => `- ${entry.label ?? entry.concept ?? entry}`), '', 'Questions recommandees', ...(brief?.questions ?? []).map((question: any, index: number) => `${index + 1}. [${question.priority === 'HIGH' ? 'Essentielle' : question.priority === 'OPTIONAL' ? 'Optionnelle' : 'A approfondir'}] ${question.question}`), '', 'Notes pre-entretien', String(item.assistantNotes ?? '').slice(0, 3000),
    ];
    return buildBriefPdf(lines);
  }
}
