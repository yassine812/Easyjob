import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InterviewStatus, InterviewType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsArray, ArrayMaxSize,
} from 'class-validator';

export class CreateInterviewDto {
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true })
  memberIds?: string[];
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  applicationId!: string;

  @ApiProperty({ description: 'ISO start time' })
  @IsDateString()
  startAt!: string;

  @ApiProperty({ description: 'ISO end time' })
  @IsDateString()
  endAt!: string;

  @ApiProperty({ enum: InterviewType })
  @IsEnum(InterviewType)
  type!: InterviewType;

  @ApiPropertyOptional({ description: 'Meeting URL or physical location' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpdateInterviewDto {
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true })
  memberIds?: string[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ enum: InterviewType })
  @IsOptional()
  @IsEnum(InterviewType)
  type?: InterviewType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @ApiPropertyOptional({ enum: InterviewStatus })
  @IsOptional()
  @IsEnum(InterviewStatus)
  status?: InterviewStatus;
}
