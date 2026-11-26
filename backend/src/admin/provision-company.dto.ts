import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateCompanyDto } from '../companies/dto/company.dto';
export class ProvisionCompanyDto extends CreateCompanyDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  ownerName!: string;
  @IsEmail() @MaxLength(254)
  ownerEmail!: string;

  @IsOptional() @IsString() @MaxLength(30)
  ownerPhone?: string;

  @IsOptional() @IsString() @MaxLength(40)
  planName?: string;

  @IsOptional() @IsString() @MaxLength(80)
  timezone?: string;

  @IsOptional() @IsIn(['TND', 'EUR', 'USD'])
  currency?: string;
}
