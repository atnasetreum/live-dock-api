import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { REQUEST } from '@nestjs/core';

import * as URLSafeBase64 from 'urlsafe-base64';
import { In, Repository } from 'typeorm';
import { type Request } from 'express';
import * as webpush from 'web-push';

import { User, UserRole } from '../users/entities/user.entity';
import { Subscription } from './entities/subscription.entity';
import * as vapidKeys from 'src/config/vapid-keys.json';
import { UsersService } from '../users/users.service';
import {
  ReceptionProcess,
  ReceptionProcessTypeOfMaterial,
} from '../reception-process/entities/reception-process.entity';
import { ConfigService } from '@nestjs/config';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
webpush.setVapidDetails(
  'mailto:example@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey,
);

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  private publicBackendUrl: string;

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.publicBackendUrl =
      this.configService.get<string>('publicBackendUrl') ?? '';
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

  async createReceptionProcessNotification(
    receptionProcess: {
      typeOfMaterial: ReceptionProcessTypeOfMaterial;
      createdBy: User;
    } & ReceptionProcess,
    expiredUser?: User,
  ) {
    const { id, typeOfMaterial, createdBy } = receptionProcess;

    let usersIds: number[] = [];

    if (!expiredUser) {
      const logisticsUsers = await this.usersService.findAllByRole(
        UserRole.LOGISTICA,
      );

      console.log({ size: logisticsUsers.length });

      // usersIds = [createdBy.id, ...logisticsUsers.map((user) => user.id)];
      // usersIds = [...logisticsUsers.map((user) => user.id)]; // Correcto
      usersIds = [createdBy.id]; // TODO: Eliminar esto
    } else {
      usersIds = [expiredUser.id];
    }

    const subscriptions = await this.subscriptionRepository.find({
      where: {
        user: {
          id: In(usersIds),
        },
        isActive: true,
      },
      relations: ['user'],
    });

    const eventTime = new Date().toISOString();

    await Promise.all(
      subscriptions.map((subscription) =>
        this.sendNotification(subscription, {
          title: 'Llegada de pipa 🚛➡️🏭',
          body: `# Identificador: ${id} \nTipo de material: ${typeOfMaterial} \nCreado por: ${createdBy.name}`,
          typeNotification: 'waiting',
          tagId: `reception-process-${id}`,
          eventTime,
          requireInteraction: true,
          vibrate: [200],
          actions: [
            {
              action: 'confirm-logistic',
              title: 'Confirmar',
            },
          ],
          data: {
            id,
            notifiedUserId: subscription.user.id,
            publicBackendUrl: this.publicBackendUrl,
          },
        }),
      ),
    );
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
