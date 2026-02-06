import {
  Controller,
  Get,
  Post,
  Req,
  BadRequestException,
} from '@nestjs/common';

import { type Request } from 'express';

import { PushNotificationsService } from './push-notifications.service';

@Controller('push-notifications')
export class PushNotificationsController {
  constructor(
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  @Post('/subscribe')
  createSubscribe(@Req() req: Request) {
    const { subscription } = req.body as { subscription: string };

    if (!subscription) {
      throw new BadRequestException('Subscription is required');
    }

    return this.pushNotificationsService.createSubscribe({
      subscription,
    });
  }

  @Get('/public-key')
  findPublicKey() {
    return this.pushNotificationsService.findPublicKey();
  }

  @Post('/test-push')
  testPushNotification() {
    return this.pushNotificationsService.testPushNotification();
  }
}
