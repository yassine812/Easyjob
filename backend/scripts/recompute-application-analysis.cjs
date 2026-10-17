require('dotenv/config');
require('ts-node/register/transpile-only');

const { PrismaClient } = require('@prisma/client');
const { matchCandidate } = require('../src/career/career-engine');
const { analyzeGrowthPotential } = require('../src/career/growth-potential');
const { recruitmentClassification, DEFAULT_THRESHOLDS } = require('../src/companies/recruitment-metrics');

const prisma = new PrismaClient();

function hasGrowthAnalysis(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && value.growthAnalysis && typeof value.growthAnalysis === 'object';
}

function hasMissingAnalysis(application) {
  const explanation = application.matchExplanation;
  return application.potentialScore == null || !hasGrowthAnalysis(explanation);
}

function analysisProfile(profile) {
  return {
    ...profile,
    skills: profile.skills,
    experiences: profile.experiences,
    educations: profile.educations,
    resumes: profile.resumes,
  };
}

async function recompute(application, dryRun) {
  const profile = analysisProfile(application.candidate);
  const resumeText = application.resume?.parsedText || application.cvTextSnapshot || '';
  const match = matchCandidate({ ...profile, resumes: resumeText ? [{ parsedText: resumeText }] : profile.resumes }, application.job);
  const growth = analyzeGrowthPotential(profile, application.job, match, application.coverLetter || application.motivation || '');
  const criticalGaps = (match.evidenceAnalysis?.requirements || []).filter(requirement => requirement.priority === 'REQUIRED' && ['NOT_FOUND', 'CONFLICTING'].includes(requirement.status)).length;
  const classification = recruitmentClassification(match.score, growth.category, DEFAULT_THRESHOLDS, criticalGaps);
  const explanation = application.matchExplanation && typeof application.matchExplanation === 'object' && !Array.isArray(application.matchExplanation)
    ? application.matchExplanation
    : {};
  const nextStatus = match.score == null ? 'PENDING' : 'COMPLETED';
  const data = {
    aiMatchScore: match.score,
    aiQualification: match.classification,
    aiRecommendation: match.classification,
    aiSummary: match.summary,
    potentialScore: growth.category,
    potentialReason: growth.summary,
    strengths: match.matchedSkills.join(', '),
    missingRequirements: [...match.missingSkills, ...match.unverifiedRequirements].join('; '),
    aiScreeningStatus: nextStatus,
    aiScreenedAt: nextStatus === 'COMPLETED' ? (application.aiScreenedAt || new Date()) : null,
    matchExplanation: {
      ...explanation,
      ...match,
      growthAnalysis: growth,
    },
  };
  const isDemo = typeof application.job.slug === 'string' && application.job.slug.startsWith('demo-recruiter-');
  const incompatible = classification === 'LOW_ALIGNMENT' && ['INTERVIEW', 'OFFER', 'HIRED'].includes(application.status) && (isDemo || application.stageChangeSource !== 'RECRUITER');
  if (incompatible) {
    data.status = 'APPLIED';
    data.stageChangedAt = null;
    data.stageChangedById = null;
    data.stageChangeSource = 'SYSTEM';
  }
  if (!dryRun) {
    await prisma.application.update({ where: { id: application.id }, data });
    if (incompatible) await prisma.applicationEvent.create({ data: { applicationId: application.id, actorId: null, previousStatus: application.status, newStatus: 'APPLIED', metadata: { source: 'analysis_backfill', classification } } });
  }
  return { id: application.id, before: { match: application.aiMatchScore, potential: application.potentialScore, status: application.status }, after: { match: match.score, potential: growth.category, classification, status: incompatible ? 'APPLIED' : application.status, analysisStatus: nextStatus } };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const recomputeAll = process.argv.includes('--all');
  const applications = await prisma.application.findMany({
    where: { ...(recomputeAll ? {} : { OR: [
      { aiScreeningStatus: { in: ['COMPLETED', 'READY'] } },
      { aiMatchScore: { not: null }, potentialScore: null },
    ] }) },
    select: {
      id: true,
      status: true,
      stageChangeSource: true,
      aiMatchScore: true,
      potentialScore: true,
      aiScreenedAt: true,
      aiScreeningStatus: true,
      matchExplanation: true,
      coverLetter: true,
      motivation: true,
      cvTextSnapshot: true,
      resume: { select: { parsedText: true } },
      job: {
        select: { id: true, slug: true, title: true, description: true, requirements: true, skills: { include: { skill: true } } },
      },
      candidate: {
        include: {
          skills: { include: { skill: true } },
          experiences: true,
          educations: true,
          resumes: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] },
        },
      },
    },
    orderBy: { appliedAt: 'asc' },
  });
  const targets = recomputeAll ? applications : applications.filter(hasMissingAnalysis);
  let recalculated = 0;
  let pending = 0;
  for (const application of targets) {
    const result = await recompute(application, dryRun);
    recalculated += 1;
    if (result.after.status !== 'COMPLETED') pending += 1;
    console.log(JSON.stringify(result));
  }
  console.log(JSON.stringify({ mode: recomputeAll ? 'all' : 'missing-potential', dryRun, scanned: applications.length, recalculated, pending }));
}

main()
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
