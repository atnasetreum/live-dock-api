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
  ProcessEventOption,
  ProcessEventRole,
  ProcessState,
} from '../entities';

export class NextEventDto {
  @IsEnum(ProcessEventOption)
  event: ProcessEventOption;

  @IsEnum(ProcessState)
  statusProcess: ProcessState;

  @IsEnum(ProcessEventRole)
  eventRole: ProcessEventRole;
}

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
  nextEvent?: NextEventDto;
}
