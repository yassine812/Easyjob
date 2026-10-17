import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const SUPPORT_CATEGORIES = [
  'ACCOUNT',
  'CV_ATS',
  'JOB_APPLICATION',
  'AUTO_APPLY',
  'INTERVIEW_PREPARATION',
  'SUBSCRIPTION_PAYMENT',
  'BUG',
  'OTHER',
] as const;

export class CreateSupportTicketDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  subject!: string;

  @IsIn(SUPPORT_CATEGORIES)
  category!: (typeof SUPPORT_CATEGORIES)[number];

  @IsString()
  @MinLength(10)
  @MaxLength(12000)
  message!: string;

  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH'])
  priority?: string;
}

export class CreateSupportMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  message!: string;
}

export class UpdateSupportTicketDto {
  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED'])
  status?: string;

  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH'])
  priority?: string;
}

export class SupportTicketQueryDto {
  @IsOptional() @IsIn(['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED']) status?: string;
  @IsOptional() @IsIn(SUPPORT_CATEGORIES) category?: (typeof SUPPORT_CATEGORIES)[number];
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}
