import { PartialType } from '@nestjs/mapped-types';

import { CreateReceptionProcessDto } from './create-reception-process.dto';
import { ReceptionProcessStatus } from '../entities';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateReceptionProcessDto extends PartialType(
  CreateReceptionProcessDto,
) {
  @IsOptional()
  @IsEnum(ReceptionProcessStatus)
  status?: ReceptionProcessStatus;
}
