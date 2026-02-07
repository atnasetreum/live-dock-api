import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { REQUEST } from '@nestjs/core';

import * as URLSafeBase64 from 'urlsafe-base64';
import { type Request } from 'express';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';

import { Subscription } from './entities/subscription.entity';
import * as vapidKeys from 'src/config/vapid-keys.json';
import { User } from '../users';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
webpush.setVapidDetails(
  'mailto:example@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey,
);

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {
    this.logger.debug('PushNotificationsService initialized');
  }

  get currentUser() {
    return this.request['user'] as User;
  }

  async createSubscribe({ subscription }: { subscription: string }) {
    const user = this.currentUser;

    const subscriptionNew = this.subscriptionRepository.create({
      subscription,
      user,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const subscriptionCreate =
      await this.subscriptionRepository.save(subscriptionNew);

    return subscriptionCreate;
  }

  findPublicKey() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (URLSafeBase64 as any).decode(vapidKeys.publicKey) as Buffer;
  }

  async testPushNotification(body: Record<string, unknown>) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { isActive: true },
    });

    if (!subscription) {
      this.logger.warn('No active subscription found');
      return { message: 'No active subscription found' };
    }

    const eventTime = new Date().toISOString();
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    await sleep(1000);

    await this.sendNotification(subscription, {
      title: body?.title ?? '',
      body: body?.body ?? '',
      typeNotification: body?.typeNotification ?? '',
      tagId: body?.tagId ?? '',
      eventTime,
    });

    return { message: 'test push endpoint' };
  }

  private async sendNotification(
    subscription: Subscription,
    options: Record<string, any>,
  ) {
    await webpush
      .sendNotification(
        JSON.parse(subscription.subscription) as webpush.PushSubscription,
        JSON.stringify(options),
      )
      .then(() => {
        this.logger.debug('Notification sent');
      })
      .catch(async (err: unknown) => {
        const statusCode =
          (err as Record<string, unknown>)?.statusCode ||
          (err as Record<string, unknown>)?.status;

        if (statusCode === 410) {
          await this.subscriptionRepository.remove(subscription);
        }
      });
  }
}
