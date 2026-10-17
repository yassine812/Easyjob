import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';
import { EmploymentType, ExperienceLevel, JobSourceType } from '@prisma/client';

export class CareerSearchDto {
  @IsOptional() @IsEnum(JobSourceType) source?: string;
  @IsOptional() @IsIn(['CDI', 'CDD']) contractType?: string;
  @IsOptional() @IsString() @MaxLength(100) companyId?: string;
  @IsOptional() @IsString() @MaxLength(150) company?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([1, 7, 14, 30]) publishedWithin?: number;
  @IsOptional() @IsString() @MaxLength(200) keyword?: string;
  @IsOptional() @IsString() @MaxLength(120) domain?: string;
  @IsOptional() @IsString() @MaxLength(150) location?: string;
  @IsOptional() @IsIn(['REMOTE', 'HYBRID', 'ONSITE']) workMode?: string;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @IsOptional() @IsEnum(ExperienceLevel) experienceLevel?: ExperienceLevel;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) salaryMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) salaryMax?: number;
  @IsOptional() @IsIn(['TND', 'EUR', 'USD', 'GBP', 'CAD']) currency?: string;
  @IsOptional() @IsString() @MaxLength(500) skills?: string;
  @IsOptional() @IsIn(['relevance', 'newest', 'match', 'salaryHigh', 'salaryLow']) sort?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) minimumScore?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}
export class CareerSettingsDto {
  @IsOptional() @IsBoolean() approvalRequired?: boolean;
  @IsOptional() @IsBoolean() unattendedConsent?: boolean;
  @IsOptional() @IsString() @MaxLength(100) preferredResumeId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) maxPerWeek?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(150, { each: true }) targetTitles?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(150, { each: true }) requiredSkills?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(150, { each: true }) excludedKeywords?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(150, { each: true }) experienceLevels?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(2) @IsIn(['CDI', 'CDD'], { each: true }) contractTypes?: string[];
  @IsOptional() @IsBoolean() emailAlerts?: boolean;
  @IsOptional() @IsIn(['INSTANT', 'DAILY', 'WEEKLY']) frequency?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(150, { each: true }) domains?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(150, { each: true }) locations?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsIn(['REMOTE', 'HYBRID', 'ONSITE'], { each: true }) workModes?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(100) minimumScore?: number;
  @IsOptional() @IsBoolean() autoApply?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100) autoMinimumScore?: number;
  @IsOptional() @IsInt() @Min(1) @Max(20) maxPerDay?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(150, { each: true }) excludedCompanies?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsEnum(EmploymentType, { each: true }) excludedJobTypes?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsEnum(EmploymentType, { each: true }) employmentTypes?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) @MaxLength(100, { each: true }) excludedJobs?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(100000000) minimumSalary?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(100000000) maximumSalary?: number | null;
  @IsOptional() @IsIn(['USD', 'EUR', 'TND', 'GBP', 'CAD']) salaryCurrency?: string;
  @IsOptional() @IsString() @MaxLength(100) approvedDraftId?: string;
  @IsOptional() @IsBoolean() consent?: boolean;
}
export class BuildDraftDto {
  @IsOptional() @IsIn(['fr', 'en', 'ar']) language?: string;
  @IsOptional() @IsString() @MaxLength(150) targetRole?: string;
  @IsString() @MinLength(2) @MaxLength(150) title!: string;
  @IsOptional() @IsString() @MaxLength(100) jobId?: string;
  @IsOptional() @IsString() @MaxLength(100) resumeId?: string;
  @IsOptional() @IsIn(['profile', 'optimize', 'tailor', 'manual']) mode?: string;
}
export class SaveDraftDto {
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
  @IsOptional() @IsIn(['classic', 'technology', 'executive', 'academic', 'creative', 'modern', 'precision', 'signature']) template?: string;
  @IsOptional() @IsInt() @Min(11) @Max(17) fontSize?: number;
  @IsString() @MinLength(20) @MaxLength(50000) content!: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) title?: string;
  @IsOptional() @IsBoolean() approve?: boolean;
}
export class RegenerateSectionDto {
  @IsString() @MinLength(20) @MaxLength(50000) content!: string;
  @IsInt() @Min(0) @Max(100) sectionIndex!: number;
  @IsOptional() @IsInt() @Min(0) @Max(2000) lineIndex?: number;
}
export class ProfessionalDataDto {
  @IsString() @MaxLength(12000) summary!: string;
  @IsString() @MaxLength(12000) experience!: string;
  @IsString() @MaxLength(12000) education!: string;
  @IsString() @MaxLength(5000) skills!: string;
  @IsString() @MaxLength(5000) languages!: string;
  @IsString() @MaxLength(10000) certifications!: string;
  @IsString() @MaxLength(12000) projects!: string;
}
export class CreateCoachDto {
  @IsOptional() @IsString() @MaxLength(100) resumeId?: string;
  @IsOptional() @IsString() @MaxLength(12000) jobDescription?: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) companyWebsite?: string;
  @IsOptional() @IsString() @MaxLength(100) jobId?: string;
  @IsString() @MinLength(2) @MaxLength(150) jobTitle!: string;
  @IsOptional() @IsString() @MaxLength(150) company?: string;
  @IsIn(['RECOMMENDED', 'TECHNICAL', 'CODING', 'SYSTEM_DESIGN', 'HR', 'BEHAVIORAL', 'SITUATIONAL', 'MANAGERIAL', 'CASE_STUDY']) interviewType!: string;
  @IsIn(['en', 'fr', 'ar']) locale!: string;
  @IsBoolean() visionConsent!: boolean;
}
export class CoachAnswerDto {
  @IsInt() @Min(0) @Max(30) questionIndex!: number;
  @IsString() @MinLength(5) @MaxLength(10000) answer!: string;
  @IsOptional() @IsString() @MaxLength(10000) transcript?: string;
  @IsOptional() @IsString() @MaxLength(10000) code?: string;
  @IsOptional() @IsInt() @Min(1) @Max(3600) speakingSeconds?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) pauses?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) fillerCount?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) longPauses?: number;
}
export class CoachTurnDto {
  @IsInt() @Min(0) @Max(30) questionIndex!: number;
  @IsIn(['INTERVIEWER_SPEAKING', 'LISTENING', 'ANSWERING']) state!: 'INTERVIEWER_SPEAKING' | 'LISTENING' | 'ANSWERING';
  @IsString() @MaxLength(10000) transcript!: string;
  @IsString() @MaxLength(10000) code!: string;
}

export class InterviewAutoTestDto {
  @IsIn(['strong', 'average', 'weak', 'inconsistent']) persona!: 'strong' | 'average' | 'weak' | 'inconsistent';
  @IsOptional() @Type(() => Number) @IsIn([1, 2, 4]) speed?: number;
  @IsOptional() @IsBoolean() disableTts?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2147483647) seed?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10) maxTopics?: number;
}
