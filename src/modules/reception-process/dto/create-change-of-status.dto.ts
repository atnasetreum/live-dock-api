import { IsPositive, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { NextEventDto } from './create-notification-metric.dto';

export class CreateChangeOfStatusDto {
  @IsPositive()
  id: number;

  @IsString()
  newState: string;

  @ValidateNested()
  @Type(() => NextEventDto)
  nextEvent: NextEventDto;

  @IsString()
  actionRole: string;
}
