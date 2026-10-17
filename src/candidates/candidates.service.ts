import { publicJobSalary } from '../jobs/job-content';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CandidateVisibility, EmploymentType, Prisma, SkillLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../companies/company-access.service';
import { CompanyDirectoryService } from '../companies/company-directory.service';
import { EntitlementService } from '../entitlements/entitlement.service';
import type { CompanyContext } from '../common/types/auth';
import {
  AddSkillDto,
  EducationDto,
  ExperienceDto,
  JobPreferenceDto,
  ApplyProfileCompletionDto,
  SaveJobDto,
  UpdateCandidateProfileDto,
} from './dto/candidate.dto';

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CompanyAccessService,
    private readonly companyDirectory: CompanyDirectoryService,
    private readonly entitlements: EntitlementService,
  ) {}

  private async profileOfUser(userId: string) {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        skills: { include: { skill: true } },
        experiences: { orderBy: { startDate: 'desc' } },
        educations: { orderBy: { startDate: 'desc' } },
        resumes: { orderBy: { version: 'desc' } },
        jobPreference: true,
      },
    });
    if (!profile) throw new NotFoundException('Candidate profile not found');
    return profile;
  }

  async getMyProfile(userId: string) {
    const profile = await this.profileOfUser(userId);
    const savedJobs = await this.prisma.savedJob.findMany({
      where: { candidateId: profile.id },
      include: { job: { select: { id: true, title: true, slug: true, location: true, employmentType: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      ...this.profileDto(profile),
      savedJobs,
      profileCompletion: this.profileCompletion(profile),
      easyjobAnalysis: this.easyjobAnalysis(profile),
    };
  }

  async updateProfile(userId: string, dto: UpdateCandidateProfileDto) {
    const profile = await this.ensureProfile(userId);
    const professionalData = profile.professionalData && typeof profile.professionalData === 'object' && !Array.isArray(profile.professionalData)
      ? profile.professionalData as Record<string, unknown>
      : {};
    const languages = dto.languages?.map((language) => language.trim()).filter(Boolean);
    await this.prisma.candidateProfile.update({
      where: { userId },
      data: {
        headline: dto.headline ?? undefined,
        bio: dto.bio ?? undefined,
        location: dto.location ?? undefined,
        phone: dto.phone ?? undefined,
        yearsExperience: dto.yearsExperience ?? undefined,
        visibility: dto.visibility ?? undefined,
        remotePreference: dto.remotePreference ?? undefined,
        employmentTypePreference: dto.employmentTypePreference ?? undefined,
        // Do not overwrite extracted CV data unless the candidate has chosen
        // to save a language list in the profile editor.
        professionalData: languages === undefined ? undefined : {
          ...professionalData,
          languages,
          // cv-prefill recognises this marker and will retain confirmed data
          // on a later CV upload instead of replacing it automatically.
          method: 'candidate_reviewed',
        } as Prisma.InputJsonValue,
      },
    });
    return this.profileDto(await this.profileOfUser(userId));
  }

  async addSkill(userId: string, dto: AddSkillDto) {
    const profile = await this.ensureProfile(userId);
    const normalized = dto.name.trim().toLowerCase();
    const skill = await this.prisma.skill.upsert({
      where: { normalizedName: normalized },
      create: { name: dto.name.trim(), normalizedName: normalized },
      update: {},
    });
    await this.prisma.candidateSkill.upsert({
      where: { candidateId_skillId: { candidateId: profile.id, skillId: skill.id } },
      create: { candidateId: profile.id, skillId: skill.id, level: dto.level ?? SkillLevel.INTERMEDIATE },
      update: { level: dto.level ?? SkillLevel.INTERMEDIATE },
    });
    return { skillId: skill.id, name: skill.name, level: dto.level ?? SkillLevel.INTERMEDIATE };
  }

  async removeSkill(userId: string, skillId: string) {
    const profile = await this.ensureProfile(userId);
    await this.prisma.candidateSkill.deleteMany({
      where: { candidateId: profile.id, skillId },
    });
    return { success: true };
  }

  async addExperience(userId: string, dto: ExperienceDto) {
    const profile = await this.ensureProfile(userId);
    if (!dto.companyId && !dto.companyProvider) {
      await this.companyDirectory.rememberManualCompany(dto.companyName, dto.countryCode, dto.location, dto.companyWebsite);
    }
    return this.prisma.experience.create({
      data: {
        candidateId: profile.id,
        companyName: dto.companyName,
        companyId: dto.companyId ?? null,
        companyLogoUrl: dto.companyLogoUrl ?? null,
        companyWebsite: dto.companyWebsite ?? null,
        companyProvider: dto.companyProvider ?? null,
        location: dto.location ?? null,
        countryCode: dto.countryCode ?? null,
        title: dto.title,
        description: dto.description ?? null,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        current: dto.current ?? false,
      },
    });
  }

  async updateExperience(userId: string, experienceId: string, dto: ExperienceDto) {
    const profile = await this.ensureProfile(userId);
    const experience = await this.prisma.experience.findFirst({
      where: { id: experienceId, candidateId: profile.id },
    });
    if (!experience) throw new NotFoundException('Experience not found');
    if (!dto.companyId && !dto.companyProvider) {
      await this.companyDirectory.rememberManualCompany(dto.companyName, dto.countryCode, dto.location, dto.companyWebsite);
    }
    return this.prisma.experience.update({
      where: { id: experienceId },
      data: {
        companyName: dto.companyName,
        companyId: dto.companyId ?? null,
        companyLogoUrl: dto.companyLogoUrl ?? null,
        companyWebsite: dto.companyWebsite ?? null,
        companyProvider: dto.companyProvider ?? null,
        location: dto.location ?? null,
        countryCode: dto.countryCode ?? null,
        title: dto.title,
        description: dto.description ?? null,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        current: dto.current ?? false,
      },
    });
  }

  async deleteExperience(userId: string, experienceId: string) {
    const profile = await this.ensureProfile(userId);
    const deleted = await this.prisma.experience.deleteMany({
      where: { id: experienceId, candidateId: profile.id },
    });
    if (deleted.count === 0) throw new NotFoundException('Experience not found');
    return { success: true };
  }

  async addEducation(userId: string, dto: EducationDto) {
    const profile = await this.ensureProfile(userId);
    return this.prisma.education.create({
      data: {
        candidateId: profile.id,
        institution: dto.institution,
        degree: dto.degree ?? null,
        field: dto.field ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async updateEducation(userId: string, educationId: string, dto: EducationDto) {
    const profile = await this.ensureProfile(userId);
    const education = await this.prisma.education.findFirst({
      where: { id: educationId, candidateId: profile.id },
    });
    if (!education) throw new NotFoundException('Education not found');
    return this.prisma.education.update({
      where: { id: educationId },
      data: {
        institution: dto.institution,
        degree: dto.degree ?? null,
        field: dto.field ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async deleteEducation(userId: string, educationId: string) {
    const profile = await this.ensureProfile(userId);
    const deleted = await this.prisma.education.deleteMany({
      where: { id: educationId, candidateId: profile.id },
    });
    if (deleted.count === 0) throw new NotFoundException('Education not found');
    return { success: true };
  }

  async saveJob(userId: string, dto: SaveJobDto) {
    const profile = await this.ensureProfile(userId);
    const job = await this.prisma.job.findFirst({ where: { id: dto.jobId, status: 'PUBLISHED', company: { status: 'ACTIVE', verification: { status: 'VERIFIED' } }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
    if (!job || job.status !== 'PUBLISHED') {
      throw new NotFoundException('Job not found');
    }
    await this.prisma.savedJob.upsert({
      where: { candidateId_jobId: { candidateId: profile.id, jobId: dto.jobId } },
      create: { candidateId: profile.id, jobId: dto.jobId },
      update: {},
    });
    return { success: true };
  }

  async removeSavedJob(userId: string, jobId: string) {
    const profile = await this.ensureProfile(userId);
    await this.prisma.savedJob.deleteMany({ where: { candidateId: profile.id, jobId } });
    return { success: true };
  }

  async listSavedJobs(userId: string) {
    const profile = await this.ensureProfile(userId);
    const saved = await this.prisma.savedJob.findMany({
      where: { candidateId: profile.id, job: { status: 'PUBLISHED', company: { status: 'ACTIVE', verification: { status: 'VERIFIED' } }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } },
      include: { job: { include: { skills: { include: { skill: true } }, applications: { where: { candidateId: profile.id }, select: { id: true } }, company: { select: { id: true, commercialName: true, slug: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return saved.map(item => { const { applications, ...job } = item.job; return { ...item, job: publicJobSalary(job), applied: applications.length > 0 }; });
  }

  async getJobPreferences(userId: string) {
    const profile = await this.ensureProfile(userId);
    return this.prisma.jobPreference.findUnique({ where: { candidateId: profile.id } });
  }

  async updateJobPreferences(userId: string, dto: JobPreferenceDto) {
    const profile = await this.ensureProfile(userId);
    return this.prisma.jobPreference.upsert({
      where: { candidateId: profile.id },
      create: { candidateId: profile.id, ...dto },
      update: { ...dto },
    });
  }

  /**
   * Company-side view of a candidate profile, honoring visibility settings.
   * Company context is resolved from the authenticated membership (never from
   * request bodies).
   */
  async viewCandidateAsCompany(viewerUserId: string, candidateProfileId: string, company: CompanyContext) {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { id: candidateProfileId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        skills: { include: { skill: true } },
        experiences: { orderBy: { startDate: 'desc' } },
        educations: { orderBy: { startDate: 'desc' } },
        resumes: { select: { id: true, filename: true, mimeType: true, fileSize: true, version: true, isPrimary: true } },
      },
    });
    if (!profile) throw new NotFoundException('Candidate not found');

    const hasApplication = await this.prisma.application.count({
      where: {
        candidateId: profile.id,
        ...(await this.access.applicationScope(viewerUserId, company.companyId)),
      },
    });

    // A company may only view a candidate profile when there is an active
    // recruitment relationship (an application to one of its jobs), unless the
    // candidate explicitly made the profile PUBLIC. This prevents cross-company
    // candidate discovery and access to unrelated candidates' private data.
    if (profile.visibility !== CandidateVisibility.PUBLIC && !hasApplication) {
      throw new ForbiddenException('This candidate profile is not visible to your company');
    }

    const showContact = hasApplication > 0 || profile.userId === viewerUserId;
    const result = {
      id: profile.id,
      userId: profile.user.id,
      name: profile.user.name,
      user: { id: profile.user.id, name: profile.user.name, ...(showContact ? { email: profile.user.email } : {}) },
      professionalData: hasApplication ? profile.professionalData : null,
      headline: profile.headline,
      bio: profile.bio,
      location: profile.location,
      yearsExperience: profile.yearsExperience,
      visibility: profile.visibility,
      ...(showContact ? { phone: profile.phone, email: profile.user.email } : {}),
      skills: profile.skills.map((s) => ({ id: s.skillId, name: s.skill.name, level: s.level })),
      experiences: profile.experiences,
      educations: profile.educations,
      resumes: profile.resumes,
      hasApplicationToCompany: hasApplication > 0,
    };
    return result;
  }

  async getCandidateProfileIdForUser(userId: string): Promise<string> {
    const profile = await this.ensureProfile(userId);
    return profile.id;
  }

  private async ensureProfile(userId: string) {
    let profile = await this.prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) {
      profile = await this.prisma.candidateProfile.create({ data: { userId } });
    }
    return profile;
  }

  private profileDto(profile: {
    id: string;
    userId: string;
    headline: string | null;
    bio: string | null;
    location: string | null;
    phone: string | null;
    yearsExperience: number | null;
    visibility: CandidateVisibility;
    remotePreference: boolean | null;
    employmentTypePreference: unknown;
    createdAt: Date;
    updatedAt: Date;
    user?: { id: string; name: string; email: string };
    skills?: Array<{ level: SkillLevel; skill: { id: string; name: string } }>;
    experiences?: unknown[];
    educations?: unknown[];
    resumes?: unknown[];
    jobPreference?: unknown;
    professionalData?: unknown;
  }) {
    return {
      id: profile.id,
      userId: profile.userId,
      name: profile.user?.name,
      email: profile.user?.email,
      headline: profile.headline,
      bio: profile.bio,
      location: profile.location,
      phone: profile.phone,
      yearsExperience: profile.yearsExperience,
      visibility: profile.visibility,
      remotePreference: profile.remotePreference,
      employmentTypePreference: profile.employmentTypePreference,
      professionalData: profile.professionalData ?? null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      skills: profile.skills?.map((s) => ({ id: s.skill.id, name: s.skill.name, level: s.level })) ?? [],
      experiences: profile.experiences ?? [],
      educations: profile.educations ?? [],
      resumes: profile.resumes ?? [],
      jobPreference: profile.jobPreference ?? null,
    };
  }

  async searchCompanies(userId: string, query: string, countryCode?: string) {
    await this.ensureProfile(userId);
    const response = await this.companyDirectory.search(query, countryCode);
    return {
      results: response.results.map((company) => ({
        ...company,
        logoUrl: company.logoUrl ?? null,
        location: [company.city, company.countryName].filter(Boolean).join(', ') || null,
      })),
      providerAvailable: response.providerAvailable,
    };
  }

  /**
   * Produces reviewable, CV-grounded suggestions for fields that are still
   * incomplete. It never fabricates work mode, contract, salary or mobility.
   */
  async profileCompletionSuggestions(userId: string) {
    const profile = await this.profileOfUser(userId);
    await this.entitlements.assertCan({ ownerType: 'CANDIDATE', ownerId: profile.id }, 'career.builder');
    const completion = this.profileCompletion(profile);
    const existingLanguages = this.profileLanguages(profile);
    const languageSuggestions = existingLanguages.map(language => this.languageLabel(language)).filter(Boolean);
    const roleSuggestions = uniqueStrings([
      profile.headline ?? '',
      ...profile.experiences.map(experience => experience.title),
    ]).slice(0, 4);
    const preference = profile.jobPreference;

    return {
      missingFields: completion.missingFields,
      suggestions: {
        languages: completion.items.languages ? [] : languageSuggestions,
        targetRoles: preference?.jobTitle ? [] : roleSuggestions,
        location: preference?.location || !profile.location ? null : profile.location,
      },
      needsCandidateInput: {
        workArrangement: preference?.remote == null,
        contractType: preference?.employmentType == null,
      },
    };
  }

  /** Saves only selections explicitly accepted in the completion preview. */
  async applyProfileCompletion(userId: string, dto: ApplyProfileCompletionDto) {
    const profile = await this.profileOfUser(userId);
    await this.entitlements.assertCan({ ownerType: 'CANDIDATE', ownerId: profile.id }, 'career.builder');

    await this.prisma.$transaction(async tx => {
      if (dto.languages !== undefined) {
        const previous = profile.professionalData && typeof profile.professionalData === 'object' && !Array.isArray(profile.professionalData)
          ? profile.professionalData as Record<string, unknown>
          : {};
        const languages = dto.languages.map(language => language.trim()).filter(Boolean);
        await tx.candidateProfile.update({
          where: { id: profile.id },
          data: { professionalData: { ...previous, languages, method: 'candidate_reviewed' } as Prisma.InputJsonValue },
        });
      }

      const preferenceData = {
        jobTitle: dto.jobTitle?.trim() || undefined,
        location: dto.location?.trim() || undefined,
        remote: dto.remote,
        employmentType: dto.employmentType,
        keywords: dto.keywords?.map(keyword => keyword.trim()).filter(Boolean),
      };
      if (Object.values(preferenceData).some(value => value !== undefined)) {
        await tx.jobPreference.upsert({
          where: { candidateId: profile.id },
          create: { candidateId: profile.id, ...preferenceData },
          update: preferenceData,
        });
      }
    });
    return this.getMyProfile(userId);
  }

  private profileLanguages(profile: { professionalData?: unknown }) {
    const data = profile.professionalData as { languages?: unknown; sections?: { languages?: unknown } } | null;
    const languages = data?.languages ?? data?.sections?.languages;
    return Array.isArray(languages) ? languages.filter(Boolean) : [];
  }

  private languageLabel(language: unknown): string {
    if (typeof language === 'string') return language.trim();
    if (language && typeof language === 'object' && 'name' in language) {
      const item = language as { name?: unknown; level?: unknown };
      return [typeof item.name === 'string' ? item.name.trim() : '', typeof item.level === 'string' ? item.level.trim() : '']
        .filter(Boolean)
        .join(' · ');
    }
    return '';
  }

  private profileCompletion(profile: {
    headline: string | null; bio: string | null; location: string | null;
    skills?: unknown[]; experiences?: unknown[]; educations?: unknown[];
    resumes?: unknown[]; jobPreference?: unknown; professionalData?: unknown;
  }) {
    const items = {
      headline: Boolean(profile.headline?.trim()),
      summary: Boolean(profile.bio?.trim()),
      experience: Boolean(profile.experiences?.length),
      education: Boolean(profile.educations?.length),
      skills: Boolean(profile.skills?.length),
      languages: Boolean(this.profileLanguages(profile).length),
      jobPreferences: Boolean(profile.jobPreference),
      resume: Boolean(profile.resumes?.length),
    };
    const score = Math.round(Object.values(items).filter(Boolean).length / Object.keys(items).length * 100);
    return { score, items, missingFields: Object.entries(items).filter(([, present]) => !present).map(([key]) => key) };
  }

  /**
   * A live, objective profile-quality score. It deliberately ignores a photo,
   * name, age, gender and every other personal or protected attribute.
   */
  private easyjobAnalysis(profile: {
    headline: string | null; bio: string | null; location: string | null;
    skills?: unknown[];
    experiences?: Array<{ description?: string | null; startDate?: Date | null; endDate?: Date | null; current?: boolean }>;
    educations?: Array<{ institution?: string | null; degree?: string | null; field?: string | null }>;
    resumes?: Array<{ parsedText?: string | null; processingStatus?: string }>;
    jobPreference?: { jobTitle?: string | null; location?: string | null; remote?: boolean | null; employmentType?: EmploymentType | null } | null;
    professionalData?: unknown;
  }) {
    const languages = this.profileLanguages(profile);
    const experiences = profile.experiences ?? [];
    const educations = profile.educations ?? [];
    const resumes = profile.resumes ?? [];
    const preference = profile.jobPreference;
    const identity = (profile.headline?.trim() ? 5 : 0) + (profile.bio?.trim() ? 7 : 0) + (profile.location?.trim() ? 3 : 0);
    const experienceDescriptions = experiences.filter(item => Boolean(item.description?.trim())).length;
    const experienceDates = experiences.filter(item => Boolean(item.startDate) && (Boolean(item.endDate) || item.current === true)).length;
    const educationDetails = educations.filter(item => Boolean(item.institution?.trim()) && Boolean(item.degree?.trim() || item.field?.trim())).length;
    const preferenceFields = [preference?.jobTitle, preference?.location, preference?.remote, preference?.employmentType]
      .filter(value => value !== undefined && value !== null && value !== '').length;
    const scoreBreakdown = {
      professionalIdentity: identity,
      experience: experiences.length ? Math.min(25, 8 + Math.min(7, experiences.length * 2) + Math.min(5, experienceDescriptions * 2) + Math.min(5, experienceDates * 2)) : 0,
      skills: Math.min(20, (profile.skills?.length ?? 0) * 2),
      education: educations.length ? Math.min(10, 5 + Math.min(5, educationDetails * 3)) : 0,
      languages: Math.min(10, languages.length * 5),
      jobPreferences: Math.round(preferenceFields / 4 * 10),
      resume: resumes.some(item => item.parsedText?.trim() || item.processingStatus === 'COMPLETED') ? 10 : 0,
    };
    const profileStrength = Math.min(100, Object.values(scoreBreakdown).reduce((total, value) => total + value, 0));
    return {
      profileStrength,
      scoreBreakdown,
      skillsCount: profile.skills?.length ?? 0,
      experienceCount: experiences.length,
      educationCount: educations.length,
      languagesCount: languages.length,
    };
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}
