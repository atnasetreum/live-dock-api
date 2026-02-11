import { IsEnum } from 'class-validator';

import { ReceptionProcessTypeOfMaterial } from '../entities';

export class CreateReceptionProcessDto {
  @IsEnum(ReceptionProcessTypeOfMaterial)
  typeOfMaterial: ReceptionProcessTypeOfMaterial;
}
