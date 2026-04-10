import { IsEnum, IsString, MaxLength } from 'class-validator';

import { ReceptionProcessTypeOfMaterial } from '../entities';

export class CreateReceptionProcessDto {
  @IsString()
  @MaxLength(150)
  providerName: string;

  @IsString()
  @MaxLength(100)
  licensePlates: string;

  @IsEnum(ReceptionProcessTypeOfMaterial)
  typeOfMaterial: ReceptionProcessTypeOfMaterial;
}
