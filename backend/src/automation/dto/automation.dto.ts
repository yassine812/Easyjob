import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AutomationTriggerType } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class AutomationRuleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: AutomationTriggerType })
  @IsEnum(AutomationTriggerType)
  triggerType!: AutomationTriggerType;

  @ApiPropertyOptional({ description: 'Trigger filters, e.g. {"jobId":"..."}' })
  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Conditions, e.g. [{"field":"newStatus","op":"eq","value":"SHORTLISTED"}]' })
  @IsOptional()
  @IsArray()
  conditions?: Array<Record<string, unknown>>;

  @ApiProperty({
    description:
      'Actions, e.g. [{"type":"send_notification","config":{"userId":"...","title":"...","message":"..."}}]',
  })
  @IsArray()
  actions!: Array<{ type: string; config: Record<string, unknown> }>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
