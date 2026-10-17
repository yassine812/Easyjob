import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateCompanyDto } from '../companies/dto/company.dto';
export class ProvisionCompanyDto extends CreateCompanyDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  ownerName!: string;
  @IsEmail() @MaxLength(254)
  ownerEmail!: string;

  @IsOptional() @IsString() @MaxLength(40)
  planName?: string;
}
