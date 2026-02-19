import {
  Controller,
  Get,
  Post,
  BadRequestException,
  Body,
  Query,
} from '@nestjs/common';

import { PushNotificationsService } from './push-notifications.service';
import { User } from '../users/entities/user.entity';
import { CurrentUser } from 'src/common';

@Controller('push-notifications')
export class PushNotificationsController {
  constructor(
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  @Post('/subscribe')
  createSubscribe(
    @Body('subscription') subscription: string,
    @CurrentUser() user: User,
  ) {
    if (!subscription) {
      throw new BadRequestException('Subscription is required');
    }

    return this.pushNotificationsService.createSubscribe({
      subscription,
      user,
    });
  }

  @Post('/unsubscribe')
  unsubscribe(
    @Body('subscription') subscription: string,
    @CurrentUser() user: User,
  ) {
    if (!subscription) {
      throw new BadRequestException('Subscription is required');
    }

    return this.pushNotificationsService.unsubscribe({
      subscription,
      user,
    });
  }

  @Get('/public-key')
  findPublicKey() {
    return this.pushNotificationsService.findPublicKey();
  }

  @Get('/test-all')
  testAll(@Query('userId') userId: string) {
    return this.pushNotificationsService.testAll(+userId);
  }

  @Post('/test-push')
  testPushNotification(@Body() body: Record<string, unknown>) {
    return this.pushNotificationsService.testPushNotification(body);
  }
}
