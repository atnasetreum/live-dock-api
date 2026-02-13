import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

import { NotificationEventType } from '../entities';

export class CreateNotificationMetricDto {
  @IsPositive()
  id: number;

  @IsDate()
  visibleAt: Date;

  @IsEnum(NotificationEventType)
  eventType: NotificationEventType;

  @IsPositive()
  notifiedUserId: number;

  @IsOptional()
  @IsNumber()
  reactionTimeSec?: number;

  @IsOptional()
  @IsDate()
  accionAt?: Date;

  @IsOptional()
  @IsNumber()
  systemDelaySec?: number;

  @IsString()
  metadata: string;

  @IsOptional()
  @IsString()
  actionConfirm?: string;
}
