import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType, ExperienceLevel, SkillLevel } from '@prisma/client';
import {
  IsArray,
  ArrayUnique,
  ValidateNested,
  ArrayMaxSize,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  MinLength,
} from 'class-validator';

export class JobApplicationFieldDto {
  @IsString() @IsNotEmpty() @MaxLength(100) id!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) label!: string;
  @IsIn(['text', 'textarea', 'email', 'phone', 'url', 'number', 'date', 'boolean', 'select', 'multiselect', 'file']) type!: 'text' | 'textarea' | 'email' | 'phone' | 'url' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect' | 'file';
  @IsBoolean() required!: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(500, { each: true }) options?: string[];
}

export class JobSkillDto {
  @ApiProperty({ example: 'TypeScript' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ enum: SkillLevel })
  @IsOptional()
  @IsEnum(SkillLevel)
  level?: SkillLevel;
}

export class JobDetailsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() salaryVisible?: boolean;
  @IsOptional() @IsString() @MaxLength(150) department?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(500, { each: true }) benefits?: string[];
  @IsOptional() @IsString() @MaxLength(300) preferredEducation?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(80, { each: true }) preferredLanguages?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(10000) positions?: number;
  @IsOptional() @IsString() @MaxLength(3000) interviewProcess?: string;
}
export class CreateJobDto extends JobDetailsDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(['CDI', 'CDD', '']) contractType?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(80, { each: true }) languages?: string[];
  @ApiProperty({ example: 'Senior Backend Engineer' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(150)
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(10000)
  description!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsibilities?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(40) @ArrayUnique((field: JobApplicationFieldDto) => field.id)
  @ValidateNested({ each: true }) @Type(() => JobApplicationFieldDto)
  applicationFields?: JobApplicationFieldDto[];

  @ApiPropertyOptional({ example: 'Tunis' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  remote?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  domain?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['REMOTE', 'HYBRID', 'ONSITE'])
  workMode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  educationRequirement?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  minimumYearsExperience?: number | null;

  @ApiProperty({ enum: EmploymentType })
  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @ApiProperty({ enum: ExperienceLevel })
  @IsEnum(ExperienceLevel)
  experienceLevel!: ExperienceLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number | null;

  @ApiPropertyOptional({ enum: ['TND', 'EUR', 'USD'], default: 'TND' })
  @IsOptional()
  @IsIn(['TND', 'EUR', 'USD'])
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional({ type: [JobSkillDto] })
  @IsOptional()
  @IsArray()
  skills?: JobSkillDto[];
}

export class UpdateJobDto extends JobDetailsDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(['CDI', 'CDD', '']) contractType?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(80, { each: true }) languages?: string[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsibilities?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(40) @ArrayUnique((field: JobApplicationFieldDto) => field.id)
  @ValidateNested({ each: true }) @Type(() => JobApplicationFieldDto)
  applicationFields?: JobApplicationFieldDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  remote?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  domain?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['REMOTE', 'HYBRID', 'ONSITE'])
  workMode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  educationRequirement?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  minimumYearsExperience?: number | null;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ enum: ExperienceLevel })
  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number | null;

  @ApiPropertyOptional({ enum: ['TND', 'EUR', 'USD'] })
  @IsOptional()
  @IsIn(['TND', 'EUR', 'USD'])
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional({ type: [JobSkillDto] })
  @IsOptional()
  @IsArray()
  skills?: JobSkillDto[];
}

export class RejectJobDto {
  @ApiProperty({ example: 'Duplicate of an existing job posting' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

