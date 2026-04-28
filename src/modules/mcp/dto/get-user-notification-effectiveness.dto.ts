import { IsEnum, IsISO8601, IsNumberString, IsOptional } from 'class-validator';

import { UserRole } from 'src/modules/users/entities/user.entity';

export class GetUserNotificationEffectivenessDto {
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsNumberString()
  userId?: string;
}
