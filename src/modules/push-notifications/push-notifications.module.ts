import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PushNotificationsController } from './push-notifications.controller';
import { PushNotificationsService } from './push-notifications.service';
import { Subscription } from './entities/subscription.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription]), UsersModule],
  controllers: [PushNotificationsController],
  providers: [PushNotificationsService],
  exports: [TypeOrmModule, PushNotificationsService],
})
export class PushNotificationsModule {}
