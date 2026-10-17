import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, Matches, ValidateNested } from 'class-validator';

export class WorkspaceQuery {
  @IsOptional() @IsIn(['upcoming', 'latest']) sort?: string;
  @IsOptional() @IsString() @MaxLength(100) skill?: string;
  @IsOptional() @IsString() @MaxLength(100) location?: string;
  @IsOptional() @IsString() @MaxLength(100) education?: string;
  @IsOptional() @IsString() @MaxLength(100) language?: string;
  @IsOptional() @IsString() @MaxLength(100) certification?: string;
  @IsOptional() @IsIn(['REMOTE', 'ONSITE']) workMode?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(70) minimumExperience?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) minimumMatch?: number;
  @IsOptional() @IsIn(['EXCELLENT','STRONG','GOOD','POTENTIAL','WEAK','UNANALYZED']) matchCategory?: string;
  @IsOptional() @IsString() @MaxLength(100) memberId?: string;
  @IsOptional() @IsIn(['HR','TECHNICAL','BEHAVIORAL','MANAGERIAL','AI','FINAL','PHONE','VIDEO','ONSITE']) type?: string;
  @IsOptional() @IsString() @MaxLength(150) q?: string;
  @IsOptional() @IsString() @MaxLength(100) jobId?: string;
  @IsOptional() @IsString() @MaxLength(30) status?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
export class MatchThresholdsDto {
  @IsInt() @Min(1) @Max(100) excellent!: number;
  @IsInt() @Min(1) @Max(99) strong!: number;
  @IsInt() @Min(1) @Max(98) good!: number;
  @IsInt() @Min(0) @Max(97) potential!: number;
  @IsOptional() @IsInt() @Min(1) @Max(98) promising?: number;
  @IsOptional() @IsInt() @Min(0) @Max(97) review?: number;
}
class StageSlaHoursDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(8760) APPLIED?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(8760) SCREENING?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(8760) UNDER_REVIEW?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(8760) SHORTLISTED?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(8760) ASSESSMENT?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(8760) INTERVIEW?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(8760) OFFER?: number;
}
export class RecruitmentSettingsDto {
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(120, { each: true }) domains!: string[];
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(120, { each: true }) positions!: string[];
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(120, { each: true }) locations!: string[];
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(80, { each: true }) languages!: string[];
  @IsArray() @IsIn(['REMOTE', 'HYBRID', 'ONSITE'], { each: true }) workModes!: string[];
  @IsInt() @Min(0) @Max(100000) hiringVolume!: number;
  @ValidateNested() @Type(() => MatchThresholdsDto) thresholds!: MatchThresholdsDto;
  @IsOptional() @ValidateNested() @Type(() => StageSlaHoursDto) stageSlaHours?: StageSlaHoursDto;
  @IsOptional() @IsBoolean() completeOnboarding?: boolean;
}
export class AssignmentDto {
  @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) memberIds!: string[];
}
export class EmailTemplateDto {
  @IsString() @Matches(/\S/) @MaxLength(100) name!: string;
  @IsString() @Matches(/\S/) @MaxLength(200) subject!: string;
  @IsString() @Matches(/\S/) @MaxLength(10000) body!: string;
}
export class CommunicationDto extends EmailTemplateDto {
  @IsIn(['EMAIL', 'IN_APP', 'BOTH']) channel!: 'EMAIL' | 'IN_APP' | 'BOTH';
  @IsString() @MaxLength(100) requestId!: string;
}
class InterviewCriterionDto {
  @IsString() @MaxLength(150) label!: string;
  @IsInt() @Min(1) @Max(5) score!: number;
}
export class FeedbackDto {
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => InterviewCriterionDto) criteria?: InterviewCriterionDto[];
  @IsOptional() @IsIn(['CONTINUE','REVIEW','STOP']) recommendation?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) technical?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) communication?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) problemSolving?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) roleKnowledge?: number;
  @IsString() @MaxLength(5000) summary!: string;
  @IsOptional() @IsString() @MaxLength(3000) followUp?: string;
}
export class RecruitmentAiDto {
  @IsIn(['job', 'skills', 'criteria', 'questions', 'message', 'assessment', 'insights']) task!: string;
  @IsOptional() @IsString() @MaxLength(100) jobId?: string;
  @IsOptional() @IsString() @MaxLength(100) applicationId?: string;
  @IsIn(['en', 'fr', 'ar']) locale!: string;
  @IsOptional() @IsString() @MaxLength(5000) instruction?: string;
}
export class InterviewQuestionsDto {
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(2000, { each: true }) questions!: string[];
  @IsIn(['en', 'fr', 'ar']) locale!: string;
}
export class InterviewAnswersDto {
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(10000, { each: true }) answers!: string[];
}
export class OfferDto {
  @IsString() @MaxLength(200) title!: string;
  @IsString() @MaxLength(100) contractType!: string;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(99999999999) salaryAmount!: number;
  @IsString() @Matches(/^[A-Z]{3}$/) salaryCurrency!: string;
  @IsIn(['MONTH', 'YEAR', 'HOUR']) salaryPeriod!: string;
  @IsIn(['REMOTE', 'HYBRID', 'ONSITE']) workMode!: string;
  @IsOptional() @IsString() @MaxLength(300) location?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(200, { each: true }) benefits!: string[];
  @IsOptional() @IsString() @MaxLength(15000) terms?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}
export class OfferResponseDto {
  @IsIn(['ACCEPTED', 'DECLINED']) response!: 'ACCEPTED' | 'DECLINED';
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}
