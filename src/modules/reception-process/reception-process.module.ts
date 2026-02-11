import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { NotificationMetric, ProcessEvent, ReceptionProcess } from './entities';
import { ReceptionProcessController } from './reception-process.controller';
import { ReceptionProcessService } from './reception-process.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReceptionProcess,
      ProcessEvent,
      NotificationMetric,
    ]),
    PushNotificationsModule,
    UsersModule,
  ],
  controllers: [ReceptionProcessController],
  providers: [ReceptionProcessService],
})
export class ReceptionProcessModule {}
