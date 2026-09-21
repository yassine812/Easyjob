import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CreateCompanyDto } from '../companies/dto/company.dto';
export class ProvisionCompanyDto extends CreateCompanyDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  ownerName!: string;
  @IsEmail() @MaxLength(254)
  ownerEmail!: string;
}
