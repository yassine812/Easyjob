import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class CandidateApplicationSnapshotDto {
  @IsString() @IsNotEmpty() @MaxLength(150) fullName!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsOptional() @IsString() @MaxLength(80) phone?: string;
  @IsOptional() @IsString() @MaxLength(150) location?: string;
  @IsOptional() @IsString() @MaxLength(150) professionalTitle?: string;
  @IsOptional() @IsString() @MaxLength(5000) experience?: string;
  @IsOptional() @IsString() @MaxLength(5000) education?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(150, { each: true }) skills?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(100, { each: true }) languages?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(60) @IsString({ each: true }) @MaxLength(200, { each: true }) certifications?: string[];
  @IsOptional() @IsString() @MaxLength(500) portfolio?: string;
  @IsOptional() @IsString() @MaxLength(500) linkedIn?: string;
  @IsOptional() @IsString() @MaxLength(500) github?: string;
}

export class ApplyDto {
  @IsOptional() @IsBoolean() consent?: boolean;
  @ApiPropertyOptional({ description: 'CV version to attach (must belong to the candidate)' })
  @IsOptional()
  @IsString()
  resumeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  motivation?: string;

  @ApiPropertyOptional({ description: 'Candidate-reviewed cover letter sent with this application' })
  @IsOptional()
  @IsString()
  @MaxLength(12000)
  coverLetter?: string;

  @ApiPropertyOptional({ type: CandidateApplicationSnapshotDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateApplicationSnapshotDto)
  candidateSnapshot?: CandidateApplicationSnapshotDto;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } })
  @IsOptional()
  @IsObject()
  answers?: Record<string, string | number | boolean | string[]>;
}

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  newStatus!: ApplicationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ description: 'Source of stage change: HR, AI, or SYSTEM' })
  @IsOptional()
  @IsString()
  source?: 'HR' | 'AI' | 'SYSTEM';

  @ApiPropertyOptional({ description: 'Explicit recruiter override for a LOW_ALIGNMENT candidate' })
  @IsOptional()
  @IsBoolean()
  alignmentOverride?: boolean;

  @ApiPropertyOptional({ description: 'Why the recruiter is re-integrating a low-alignment candidate' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  overrideReason?: string;
}

export class AddApplicationNoteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string;
}

export class ApplicationMessageDto {
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @IsString() @IsNotEmpty() @MaxLength(10000) body!: string;
  @IsOptional() @IsString() @MaxLength(100) requestId?: string;
}
