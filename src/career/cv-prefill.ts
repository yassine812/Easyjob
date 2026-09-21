import { Prisma } from '@prisma/client';
import { extractProfile, normalize } from './career-engine';

/** Fill only empty fields. Conditional writes preserve edits made while extraction runs. */
export async function prefillFromCv(tx: Prisma.TransactionClient, candidateId: string, extracted: ReturnType<typeof extractProfile>) {
  const profile = await tx.candidateProfile.findUnique({ where: { id: candidateId } });
  if (!profile) return;
  const values = { phone: extracted.phone?.slice(0, 30), headline: extracted.headline?.slice(0, 120),
    location: extracted.location?.slice(0, 120), bio: (extracted.summary || extracted.sections.summary.join('\n')).slice(0, 4000) };
  for (const [field, value] of Object.entries(values)) {
    if (value && !profile[field as keyof typeof values]) await tx.candidateProfile.updateMany({
      where: { id: candidateId, OR: [{ [field]: null }, { [field]: '' }] }, data: { [field]: value },
    });
  }
  if (profile.yearsExperience == null && extracted.yearsExperience != null) await tx.candidateProfile.updateMany({
    where: { id: candidateId, yearsExperience: null }, data: { yearsExperience: extracted.yearsExperience },
  });
  // Re-read after the field updates so the JSON compare-and-set uses its current revision.
  const current = await tx.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } });
  const previous = current.professionalData as { sections?: Record<string, string[]>; method?: string } | null;
  const preserveReviewed = previous?.method === 'candidate_reviewed';
  const sections = Object.fromEntries(Object.entries(extracted.sections).map(([key, lines]) => [key,
    preserveReviewed && previous?.sections?.[key]?.length ? previous.sections[key] : lines]));
  const professionalData = preserveReviewed ? { ...extracted, ...previous, sections, needsReview: true } : { ...previous, ...extracted, sections, needsReview: true };
  await tx.candidateProfile.updateMany({ where: { id: candidateId, updatedAt: current.updatedAt }, data: {
    professionalData: JSON.parse(JSON.stringify(professionalData)) as Prisma.InputJsonValue,
  } });
  // Materialise structured entries once. Existing profile edits always win.
  if (await tx.experience.count({ where: { candidateId } }) === 0) {
    for (const entry of extracted.experiences.slice(0, 30)) {
      const dates = periodDates(entry.period); if (!dates.start) continue;
      await tx.experience.create({ data: { candidateId, title: entry.title || 'Expérience', companyName: entry.company || 'Entreprise non précisée', description: entry.description.join('\n').slice(0, 10000), startDate: dates.start, endDate: dates.end, current: dates.current } });
    }
  }
  if (await tx.education.count({ where: { candidateId } }) === 0) {
    for (const entry of extracted.educations.slice(0, 20)) {
      const dates = periodDates(entry.period);
      await tx.education.create({ data: { candidateId, degree: entry.degree || null, field: entry.field || null, institution: entry.institution || 'Établissement non précisé', startDate: dates.start, endDate: dates.end } });
    }
  }
  if (await tx.candidateSkill.count({ where: { candidateId } }) === 0) {
    for (const name of extracted.skills.slice(0, 50)) {
      const normalizedName = normalize(name);
      const skill = await tx.skill.upsert({ where: { normalizedName }, create: { name: normalizedName, normalizedName }, update: {} });
      await tx.candidateSkill.upsert({ where: { candidateId_skillId: { candidateId, skillId: skill.id } }, create: { candidateId, skillId: skill.id }, update: {} });
    }
  }
}

function periodDates(period: string) {
  const years = [...period.matchAll(/(?:19|20)\d{2}/g)].map(m => Number(m[0]));
  if (!years.length) return { start: null as Date | null, end: null as Date | null, current: false };
  const start = new Date(Date.UTC(years[0], 0, 1));
  const current = /présent|present|actuel|current|now|aujourd/i.test(period);
  return { start, end: current ? null : years[1] ? new Date(Date.UTC(years[1], 11, 31)) : null, current };
}
