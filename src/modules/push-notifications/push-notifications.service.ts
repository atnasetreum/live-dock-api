import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
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
import {
  ProcessEventOption,
  ProcessEventRole,
  ProcessState,
} from '../reception-process/entities';

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
  private appKey: string;

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.publicBackendUrl =
      this.configService.get<string>('publicBackendUrl') ?? '';
    this.appKey = this.configService.get<string>('appKey') ?? '';
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

  async unsubscribe({ subscription }: { subscription: string }) {
    const user = this.currentUser;

    const existingSubscription = await this.subscriptionRepository.findOne({
      where: {
        subscription,
        user: { id: user.id },
      },
    });

    if (!existingSubscription) {
      this.logger.warn(`Subscription not found for user ${user.id}`);
      return { message: 'Subscription not found' };
    }

    existingSubscription.isActive = false;
    existingSubscription.updatedAt = new Date();

    await this.subscriptionRepository.save(existingSubscription);

    return { message: 'Successfully unsubscribed' };
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

    const subscriptions = await this.findSubscriptionsByUserIds(usersIds);

    const eventTime = new Date().toISOString();

    await Promise.all(
      subscriptions.map((subscription) =>
        this.sendNotification(subscription, {
          title: `Ingreso de pipa #${id} 🚛➡️🏭`,
          body: `Tipo de Material: ${typeOfMaterial}\nCreado por: ${createdBy.name}`,
          requireInteraction: true,
          image: 'img-ingreso-pipa.png',
          actions: [
            {
              action: 'confirm',
              title: 'Confirmar',
            },
          ],
          data: {
            id,
            eventTime,
            notifiedUserId: subscription.user.id,
            publicBackendUrl: this.publicBackendUrl,
            appKey: this.appKey,
            nextEvent: {
              event: ProcessEventOption.LOGISTICA_CONFIRMA_PENDIENTE_DE_INGRESO,
              statusProcess: ProcessState.LOGISTICA_PENDIENTE_DE_AUTORIZACION,
              eventRole: ProcessEventRole.LOGISTICA,
            },
          },
        }),
      ),
    );
  }

  async findSubscriptionsByUserIds(userIds: number[]) {
    return this.subscriptionRepository.find({
      where: {
        user: {
          id: In(userIds),
        },
        isActive: true,
      },
      relations: ['user'],
    });
  }

  async createPendingForTestingNotification(
    receptionProcess: ReceptionProcess,
    createdBy: User,
  ) {
    const qualityUsers = await this.usersService.findAllByRole(
      UserRole.CALIDAD,
    );

    console.log({ size: qualityUsers.length });

    // usersIds = [createdBy.id, ...qualityUsers.map((user) => user.id)];
    // usersIds = [...qualityUsers.map((user) => user.id)]; // Correcto
    const usersIds = [receptionProcess.createdBy.id]; // TODO: Eliminar esto

    const subscriptions = await this.findSubscriptionsByUserIds(usersIds);

    const eventTime = new Date().toISOString();

    const { id, typeOfMaterial } = receptionProcess;

    await Promise.all(
      subscriptions.map((subscription) =>
        this.sendNotification(subscription, {
          title: 'Pendiente de evaluacion 🧪🔍',
          body: `
            # Identificador: ${id}\n
            Tipo de material: ${typeOfMaterial}\n
            Usuario que autorizó: ${createdBy.name}
          `,
          image: 'img-pending-test.png',
          eventTime,
          requireInteraction: true,
          actions: [
            {
              action: 'confirm',
              title: 'Confirmar',
            },
          ],
          data: {
            id,
            notifiedUserId: subscription.user.id,
            publicBackendUrl: this.publicBackendUrl,
            appKey: this.appKey,
            nextEvent: {
              event: ProcessEventOption.CALIDAD_CONFIRMA_PENDIENTE_DE_ANALISIS,
              statusProcess:
                ProcessState.CALIDAD_PENDIENTE_DE_CONFIRMACION_DE_ANALISIS,
              eventRole: ProcessEventRole.CALIDAD,
            },
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
