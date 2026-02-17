import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { ReceptionProcessController } from './reception-process.controller';
import { ReceptionProcessService } from './reception-process.service';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import {
  NotificationMetric,
  PriorityAlert,
  ProcessEvent,
  ReceptionProcess,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReceptionProcess,
      ProcessEvent,
      NotificationMetric,
      PriorityAlert,
    ]),
    PushNotificationsModule,
    UsersModule,
    SessionsModule,
  ],
  controllers: [ReceptionProcessController],
  providers: [ReceptionProcessService],
})
export class ReceptionProcessModule {}
