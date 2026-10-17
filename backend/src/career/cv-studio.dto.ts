import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { cvTemplateIds } from './cv-template-catalog';
export class StartCvDto {
  @IsIn(['manual', 'ai', 'import']) mode!: string;
  @IsOptional() @IsString() @MaxLength(100) resumeId?: string;
  @IsOptional() @IsString() @MaxLength(100) draftId?: string;
  @IsOptional() @IsString() @MaxLength(100) jobId?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) title?: string;
}
export class StudioSaveDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsObject() document!: object;
  @IsString() @MinLength(2) @MaxLength(150) title!: string;
  @IsIn(cvTemplateIds) template!: string;
  @IsOptional() @IsBoolean() approve?: boolean;
  @IsOptional() @IsBoolean() checkpoint?: boolean;
}
export class StudioSuggestDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @MaxLength(100) sectionId?: string;
  @IsOptional() @IsString() @MaxLength(100) entryId?: string;
  @IsOptional() @IsString() @MaxLength(100) bulletId?: string;
  @IsOptional() @IsString() @MaxLength(4000) facts?: string;
  @IsOptional() @IsString() @MaxLength(1000) instruction?: string;
  @IsOptional() @IsString() @MaxLength(4000) currentSuggestion?: string;
  @IsOptional() @IsInt() @Min(0) alternativeIndex?: number;
  @IsOptional() @IsIn(['summary', 'experience', 'education', 'skills', 'technical', 'languages', 'certifications', 'projects', 'achievements', 'volunteering', 'publications', 'interests', 'links', 'custom']) sectionType?: string;
}
export class InterviewAnswerDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @MaxLength(100) key!: string;
  @IsString() @MaxLength(4000) answer!: string;
}
export class RestoreCvDto { @IsInt() @Min(1) expectedVersion!: number; }
export class CreateCvVariantDto {
  @IsIn(['fr-FR', 'fr-CA', 'en-CA', 'en-US', 'en-GB', 'es-ES', 'de-DE', 'it-IT', 'pt-PT', 'pt-BR', 'nl-NL', 'ar-TN']) locale!: string;
  @IsIn(['labels', 'full']) mode!: 'labels' | 'full';
}
