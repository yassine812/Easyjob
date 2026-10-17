import { Injectable, Optional } from '@nestjs/common';
import { EmploymentType } from '@prisma/client';
import { EntitlementService } from '../entitlements/entitlement.service';
import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JobDraftingClient } from './job-drafting.client';
import { ExternalResearchService } from '../external-research/external-research.service';
import { EasyJobSkillsService } from '../skills/easyjob/easyjob-skills.service';

export class JobAutofillDtoShape {
  @IsString() @MinLength(2) @MaxLength(80)
  roleId!: string;
  @IsOptional() @IsIn(['JUNIOR', 'MID', 'SENIOR', 'LEAD'])
  seniority?: 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD';
  @IsOptional() @IsString() @MaxLength(150)
  location?: string;
  @IsOptional() @IsIn(['REMOTE', 'HYBRID', 'ONSITE'])
  workMode?: 'REMOTE' | 'HYBRID' | 'ONSITE';
  @IsOptional() @IsEnum(EmploymentType)
  employmentType?: EmploymentType;
  @IsOptional() @IsIn(['en', 'fr', 'ar'])
  locale?: 'en' | 'fr' | 'ar';
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(80, { each: true })
  skills?: string[];
  @IsOptional() @IsIn(['', 'CDI', 'CDD'])
  contractType?: string;
}

@Injectable()
export class JobQualityValidator {
  validate(draft: { title?: string | null; description?: string | null; responsibilities?: string[] | null; requirements?: string[] | null; skills?: Array<{ required: boolean }> | null; minimumYearsExperience?: number | null; experienceLevel?: string | null; salaryMin?: number | null; salaryMax?: number | null }) {
    const warnings: string[] = [];
    if (!draft.title?.trim()) warnings.push('Le titre du poste est obligatoire.');
    if (!draft.description?.trim()) warnings.push('Ajoutez une description du poste.');
    if (!draft.responsibilities?.filter(Boolean).length) warnings.push('Ajoutez au moins une responsabilité.');
    if (!draft.skills?.some(skill => skill.required) && !draft.requirements?.filter(Boolean).length) warnings.push('Ajoutez au moins une compétence requise.');
    if (draft.salaryMin != null && draft.salaryMax != null && draft.salaryMax < draft.salaryMin) warnings.push('Le salaire maximum doit être supérieur ou égal au minimum.');
    if (draft.experienceLevel === 'SENIOR' && (draft.minimumYearsExperience ?? 0) < 3) warnings.push('Le niveau Senior semble incohérent avec moins de 3 ans d’expérience.');
    return warnings;
  }
}

@Injectable()
export class JobAutofillService {
  constructor(private readonly drafting: JobDraftingClient, private readonly entitlements: EntitlementService, private readonly prisma: PrismaService, @Optional() private readonly externalResearch?: ExternalResearchService, @Optional() private readonly skills?: EasyJobSkillsService) {}
  async build(companyId: string, input: JobAutofillDtoShape) {
    await this.entitlements.assertCan({ ownerType: 'COMPANY', ownerId: companyId }, 'smart_job_creation');
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { commercialName: true, industry: true, website: true } });
    const draft = await this.drafting.generate(input, company);
    const researchInput = { userId: 'system', companyId, locale: input.locale ?? 'fr', permissions: ['company.research'], input: { companyName: company.commercialName, website: company.website, jobId: input.roleId, title: draft.title ?? input.roleId, seniority: input.seniority, technologies: input.skills } };
    if (this.skills) void this.skills.execute('company-public-context', researchInput).catch(() => undefined);
    else void this.externalResearch?.enqueueJobContext(researchInput.input as any).catch(() => undefined);
    const suggestions = this.skills ? await this.skills.execute('smart-job-creation', { userId: 'system', companyId, locale: input.locale ?? 'fr', permissions: ['job.create'], input: { ...input, title: draft.title ?? input.roleId, draft } }) : null;
    return { ...draft, suggestions: suggestions?.output ?? null, externalResearch: { status: this.externalResearch?.isEnabled() ? 'QUEUED' : 'DISABLED', label: 'Recherche publique' } };
  }
}
