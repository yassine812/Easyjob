import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  IsArray, ArrayMaxSize,
} from 'class-validator';

export class CreateCompanyDto {
  @IsOptional() @IsString() @MaxLength(80)
  size?: string;
  @ApiProperty({ example: 'Acme Inc.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  legalName!: string;

  @ApiProperty({ example: 'Acme' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  commercialName!: string;

  @ApiPropertyOptional({ example: 'https://acme.example.com' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  website?: string;

  @ApiPropertyOptional({ example: 'SaaS' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: 'Tunis' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'TN' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'contact@acme.example.com' })
  @IsOptional()
  @IsEmail()
  professionalEmail?: string;

  @ApiPropertyOptional({ description: 'Registration / tax identifier' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  registrationIdentifier?: string;
}

export class UpdateCompanyDto {
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(300, { each: true })
  benefits?: string[];
  @IsOptional() @IsString() @MaxLength(80)
  size?: string;
  @IsOptional() @IsString() @MaxLength(4000)
  culture?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  commercialName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  professionalEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  registrationIdentifier?: string;
}
