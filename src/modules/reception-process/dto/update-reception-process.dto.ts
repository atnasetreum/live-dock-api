import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

import { CreateReceptionProcessDto } from './create-reception-process.dto';
import { ReceptionProcessStatus } from '../entities';

export class UpdateReceptionProcessDto extends PartialType(
  CreateReceptionProcessDto,
) {
  @IsOptional()
  @IsEnum(ReceptionProcessStatus)
  status?: ReceptionProcessStatus;

  @IsOptional()
  @IsNumber()
  processingTimeMinutes?: number;
}
