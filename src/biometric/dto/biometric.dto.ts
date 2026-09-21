import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Explicit consent is required to enroll (privacy requirement). */
export class EnrollStartDto {
  @ApiProperty({ description: 'Explicit opt-in consent to biometric processing' })
  @IsBoolean()
  consent!: boolean;
}

export class EnrollVerifyDto {
  @ApiProperty()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  enrollmentId!: string;
}

export class FaceLoginStartDto {
  @ApiProperty({ description: 'Account email (used only to resolve the enrolled credential)' })
  @IsEmail()
  email!: string;
}

export class FaceLoginVerifyDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  challengeId!: string;

  @ApiProperty({ description: 'Optional client nonce to bind a challenge to one device/session' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'nonce must be alphanumeric' })
  nonce?: string;
}
