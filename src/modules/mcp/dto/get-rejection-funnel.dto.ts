import { IsEnum, IsISO8601, IsOptional } from 'class-validator';

import { ProcessEventRole } from 'src/modules/reception-process/entities';

export class GetRejectionFunnelDto {
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsEnum(ProcessEventRole)
  role?: ProcessEventRole;
}
