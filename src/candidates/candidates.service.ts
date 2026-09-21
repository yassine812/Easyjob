import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CandidateVisibility, SkillLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../companies/company-access.service';
import type { CompanyContext } from '../common/types/auth';
import {
  AddSkillDto,
  EducationDto,
  ExperienceDto,
  JobPreferenceDto,
  SaveJobDto,
  UpdateCandidateProfileDto,
} from './dto/candidate.dto';

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CompanyAccessService,
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
    };
  }

  async updateProfile(userId: string, dto: UpdateCandidateProfileDto) {
    await this.ensureProfile(userId);
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
    return this.prisma.experience.create({
      data: {
        candidateId: profile.id,
        companyName: dto.companyName,
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
    return this.prisma.experience.update({
      where: { id: experienceId },
      data: {
        companyName: dto.companyName,
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
      where: { candidateId: profile.id, job: { status: { in: ['PUBLISHED', 'CLOSED', 'EXPIRED'] }, company: { status: 'ACTIVE', verification: { status: 'VERIFIED' } } } },
      include: { job: { include: { skills: { include: { skill: true } }, applications: { where: { candidateId: profile.id }, select: { id: true } }, company: { select: { id: true, commercialName: true, slug: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return saved.map(item => { const { applications, ...job } = item.job; return { ...item, job, applied: applications.length > 0 }; });
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
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      skills: profile.skills?.map((s) => ({ id: s.skill.id, name: s.skill.name, level: s.level })) ?? [],
      experiences: profile.experiences ?? [],
      educations: profile.educations ?? [],
      resumes: profile.resumes ?? [],
      jobPreference: profile.jobPreference ?? null,
    };
  }
}
