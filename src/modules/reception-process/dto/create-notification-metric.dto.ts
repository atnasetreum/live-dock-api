import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

import {
  NotificationEventType,
  ProcessEventRole,
  ProcessState,
} from '../entities';

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
  @IsEnum(ProcessEventRole)
  eventRole?: ProcessEventRole;

  @IsOptional()
  @IsEnum(ProcessState)
  statusProcess?: ProcessState;
}
