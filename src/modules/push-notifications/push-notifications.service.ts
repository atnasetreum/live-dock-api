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
    });

    const subscriptionCreate =
      await this.subscriptionRepository.save(subscriptionNew);

    return subscriptionCreate;
  }

  findPublicKey() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (URLSafeBase64 as any).decode(vapidKeys.publicKey) as Buffer;
  }

  async testPushNotification() {
    const options = {
      title: 'FINANCES powered by Delfos',
      body: 'Hola equipo de finanzas, tienes un nuevo soporte',
      icon: '/img/logos/delfos-isologotipo-dataservice-vertical.svg',
      badge: '/img/logos/delfos-isologotipo-dataservice-vertical.svg',
      openUrl: '/',
      data: {
        //url: '/supports?id=5196',
        url: '/supports',
      },
    };

    console.log({ currentUser: this.currentUser });

    const subscription = await this.subscriptionRepository.findOne({
      //where: { user: { id: this.currentUser.id }, isActive: true },
      where: { isActive: true },
    });

    if (subscription) {
      await webpush
        .sendNotification(
          JSON.parse(subscription.subscription),
          JSON.stringify(options),
        )
        .then(() => {
          this.logger.debug('Notification sent');
        })
        .catch((err) => {
          const statusCode = err.statusCode || err.status;

          if (statusCode === 410) {
            this.subscriptionRepository.remove(subscription);
          }
        });
    }

    return 'test push endpoint';
  }

  /* async sendPush() {
    const subscriptions = await this.subscriptionRepository.find({
      where: { isActive: true },
    });

    if (subscriptions.length) {
      subscriptions.forEach((data) => {
        const options = {
          title: 'FINANCES powered by Delfos',
          body: 'Hola equipo de finanzas, tienes un nuevo soporte',
          icon: '/img/logos/delfos-isologotipo-dataservice-vertical.svg',
          badge: '/img/logos/delfos-isologotipo-dataservice-vertical.svg',
          openUrl: '/',
          data: {
            //url: '/supports?id=5196',
            url: '/supports',
          },
        };

        this.sendNotification(data, options);
      });
    }

    return 'push endpoint';
  }

  async sendNotification(dataDb: Subscription, options: Record<string, any>) {
    const subscription = JSON.parse(dataDb.subscription);

    await webpush
      .sendNotification(subscription, JSON.stringify(options))
      .then(() => {
        this.logger.debug('Notification sent');
      })
      .catch((err) => {
        if (err.statusCode === 410) {
          this.subscriptionRepository.remove(dataDb);
        }
      });
  } */
}
