import {
  Controller,
  Get,
  Post,
  Req,
  BadRequestException,
  Body,
  Query,
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

  @Post('/unsubscribe')
  unsubscribe(@Req() req: Request) {
    const { subscription } = req.body as { subscription: string };

    if (!subscription) {
      throw new BadRequestException('Subscription is required');
    }

    return this.pushNotificationsService.unsubscribe({
      subscription,
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
