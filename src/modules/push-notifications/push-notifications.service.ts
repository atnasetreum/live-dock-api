import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';

import * as URLSafeBase64 from 'urlsafe-base64';
import { In, Repository } from 'typeorm';
import { type Request } from 'express';
import * as webpush from 'web-push';

import { ReceptionProcess } from '../reception-process/entities/reception-process.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Subscription } from './entities/subscription.entity';
import * as vapidKeys from 'src/config/vapid-keys.json';
import { UsersService } from '../users/users.service';

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
  private readonly ROOT_IMG_FOLDER = '/push-notifications';

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

  get logisticsUserIds(): Promise<number[]> {
    return (async () => {
      const users = await this.usersService.findAllByRole(UserRole.LOGISTICA);
      return users.map((user) => user.id);
    })();
  }

  get qualityUserIds(): Promise<number[]> {
    return (async () => {
      const users = await this.usersService.findAllByRole(UserRole.CALIDAD);
      return users.map((user) => user.id);
    })();
  }

  get productionUserIds(): Promise<number[]> {
    return (async () => {
      const users = await this.usersService.findAllByRole(UserRole.PRODUCCION);
      return users.map((user) => user.id);
    })();
  }

  get vigilanceUserIds(): Promise<number[]> {
    return (async () => {
      const users = await this.usersService.findAllByRole(UserRole.VIGILANCIA);
      return users.map((user) => user.id);
    })();
  }

  get eventTime() {
    return new Date().toISOString();
  }

  async validateNumberOfUsers() {
    const logisticsUserIds = await this.logisticsUserIds;
    const qualityUserIds = await this.qualityUserIds;
    const productionUserIds = await this.productionUserIds;
    const vigilanceUserIds = await this.vigilanceUserIds;

    if (!logisticsUserIds.length) {
      throw new NotFoundException('No users with LOGISTICA role found');
    }

    if (!qualityUserIds.length) {
      throw new NotFoundException('No users with CALIDAD role found');
    }

    if (!productionUserIds.length) {
      throw new NotFoundException('No users with PRODUCCION role found');
    }

    if (!vigilanceUserIds.length) {
      throw new NotFoundException('No users with VIGILANCIA role found');
    }
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

    await this.subscriptionRepository.save(existingSubscription);

    return { message: 'Successfully unsubscribed' };
  }

  findPublicKey() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (URLSafeBase64 as any).decode(vapidKeys.publicKey) as Buffer;
  }

  async testAll(userId?: number) {
    const subscriptions = await this.subscriptionRepository.find({
      where: { isActive: true, ...(userId && { user: { id: userId } }) },
    });

    if (!subscriptions.length) {
      this.logger.warn('No active subscriptions found');
      throw new NotFoundException('No active subscriptions found');
    }

    await Promise.all(
      subscriptions.map((subscription) =>
        this.sendNotification(subscription, {
          title: 'Test Notification',
          body: 'Esto es una notificación de prueba para verificar que las notificaciones push funcionan correctamente.',
          tagId: `test-notification-${new Date().getTime()}`,
          data: {
            isTest: true,
            eventTime: this.eventTime,
          },
        }),
      ),
    );

    return { message: 'Test notifications sent' };
  }

  async testPushNotification(body: Record<string, unknown>) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { isActive: true },
    });

    if (!subscription) {
      this.logger.warn('No active subscription found');
      return { message: 'No active subscription found' };
    }

    const eventTime = this.eventTime;
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

  async notifiesOfArrival(
    receptionProcess: ReceptionProcess,
    expiredUser?: User,
  ) {
    const {
      id: receptionProcessId,
      typeOfMaterial,
      createdBy,
    } = receptionProcess;

    let usersIds: number[] = [];

    if (!expiredUser) {
      const logisticsUserIds = await this.logisticsUserIds;
      usersIds = [...logisticsUserIds]; // Correcto
      //usersIds = [createdBy.id]; // TODO: Eliminar esto
    } else {
      usersIds = [expiredUser.id];
    }

    const subscriptions = await this.findSubscriptionsByUserIds(usersIds);

    const actionConfirm = 'logistica_confirma_ingreso';

    await Promise.all(
      subscriptions.map((subscription) =>
        this.sendNotification(subscription, {
          title: `Ingreso de pipa #${receptionProcessId} 🚛➡️🏭`,
          body: `Tipo de Material: ${typeOfMaterial}\nCreado por: ${createdBy.name}`,
          image: 'img-ingreso-pipa.png',
          actions: [
            {
              action: 'confirm',
              title: 'Confirmar',
              icon: `${this.ROOT_IMG_FOLDER}/confirm-icon.webp`,
            },
          ],
          tagId: `ingreso-pipa-${receptionProcessId}`,
          requireInteraction: true,
          data: {
            id: receptionProcessId,
            eventTime: this.eventTime,
            notifiedUserId: subscription.user.id,
            publicBackendUrl: this.publicBackendUrl,
            appKey: this.appKey,
            actionConfirm,
          },
        }),
      ),
    );
  }

  async notifyPendingTest(receptionProcess: ReceptionProcess, createdBy: User) {
    const qualityUserIds = await this.qualityUserIds;
    const usersIds = [...qualityUserIds]; // Correcto
    //const usersIds = [createdBy.id]; // TODO: Eliminar esto

    const subscriptions = await this.findSubscriptionsByUserIds(usersIds);

    const eventTime = this.eventTime;

    const { id: receptionProcessId, typeOfMaterial } = receptionProcess;

    const actionConfirm = 'calidad_confirma_test';

    await Promise.all(
      subscriptions.map((subscription) =>
        this.sendNotification(subscription, {
          title: `Pendiente de evaluacion #${receptionProcessId} 🧪🔍`,
          body: `Tipo de material: ${typeOfMaterial}\nUsuario que autorizó: ${createdBy.name}`,
          image: 'img-pending-test.png',
          actions: [
            {
              action: 'confirm',
              title: 'Confirmar',
              icon: `${this.ROOT_IMG_FOLDER}/confirm-icon.webp`,
            },
          ],

          tagId: `pending-test-${receptionProcessId}`,
          requireInteraction: true,
          data: {
            id: receptionProcessId,
            eventTime,
            notifiedUserId: subscription.user.id,
            publicBackendUrl: this.publicBackendUrl,
            appKey: this.appKey,
            actionConfirm,
          },
        }),
      ),
    );
  }

  async notifyTestRejected(
    receptionProcess: ReceptionProcess,
    createdBy: User,
  ) {
    const qualityUserIds = await this.qualityUserIds;
    const logisticsUserIds = await this.logisticsUserIds;
    const vigilanceUserIds = await this.vigilanceUserIds;
    const usersIds = [
      ...qualityUserIds,
      ...logisticsUserIds,
      ...vigilanceUserIds,
    ]; // Correcto
    //const usersIds = [receptionProcess.createdBy.id]; // TODO: Eliminar esto

    const subscriptions = await this.findSubscriptionsByUserIds(usersIds);

    const eventTime = this.eventTime;

    const { id: receptionProcessId, typeOfMaterial } = receptionProcess;

    await Promise.all(
      subscriptions.map((subscription) =>
        this.sendNotification(subscription, {
          title: `Rechazado por calidad #${receptionProcessId} ❌🧪`,
          body: `Tipo de material: ${typeOfMaterial}\nUsuario que rechazo: ${createdBy.name}`,
          image: 'image-rejected.png',
          data: {
            id: receptionProcessId,
            eventTime,
            notifiedUserId: subscription.user.id,
            publicBackendUrl: this.publicBackendUrl,
            appKey: this.appKey,
          },
        }),
      ),
    );
  }

  async notifyPendingDownload(
    receptionProcess: ReceptionProcess,
    createdBy: User,
  ) {
    const productionUserIds = await this.productionUserIds;
    const usersIds = [...productionUserIds]; // Correcto
    //const usersIds = [createdBy.id]; // TODO: Eliminar esto

    const subscriptions = await this.findSubscriptionsByUserIds(usersIds);

    const eventTime = this.eventTime;

    const { id: receptionProcessId, typeOfMaterial } = receptionProcess;

    const actionConfirm = 'produccion_confirma_descarga';

    await Promise.all(
      subscriptions.map((subscription) =>
        this.sendNotification(subscription, {
          title: `Pendiente de descarga #${receptionProcessId} 📦⬇️`,
          body: `Tipo de material: ${typeOfMaterial}\nUsuario que autorizó: ${createdBy.name}`,
          image: 'img-pending-download.png',
          actions: [
            {
              action: 'confirm',
              title: 'Confirmar',
              icon: `${this.ROOT_IMG_FOLDER}/confirm-icon.webp`,
            },
          ],

          tagId: `pending-download-${receptionProcessId}`,
          requireInteraction: true,
          data: {
            id: receptionProcessId,
            eventTime,
            notifiedUserId: subscription.user.id,
            publicBackendUrl: this.publicBackendUrl,
            appKey: this.appKey,
            actionConfirm,
          },
        }),
      ),
    );
  }

  async notifyPendingWeightInSAP(
    receptionProcess: ReceptionProcess,
    createdBy: User,
  ) {
    const logisticsUserIds = await this.logisticsUserIds;
    const usersIds = [...logisticsUserIds]; // Correcto
    //const usersIds = [createdBy.id]; // TODO: Eliminar esto

    const subscriptions = await this.findSubscriptionsByUserIds(usersIds);

    const eventTime = this.eventTime;

    const { id: receptionProcessId, typeOfMaterial } = receptionProcess;

    const actionConfirm = 'logistica_confirma_pendiente_peso_en_sap';

    await Promise.all(
      subscriptions.map((subscription) =>
        this.sendNotification(subscription, {
          title: `Pendiente de peso en SAP #${receptionProcessId} ⚖️📦`,
          body: `Tipo de material: ${typeOfMaterial}\nUsuario que autorizó: ${createdBy.name}`,
          image: 'img-pending-weight.png',
          actions: [
            {
              action: 'confirm',
              title: 'Confirmar',
              icon: `${this.ROOT_IMG_FOLDER}/confirm-icon.webp`,
            },
          ],

          tagId: `pending-weight-${receptionProcessId}`,
          requireInteraction: true,
          data: {
            id: receptionProcessId,
            eventTime,
            notifiedUserId: subscription.user.id,
            publicBackendUrl: this.publicBackendUrl,
            appKey: this.appKey,
            actionConfirm,
          },
        }),
      ),
    );
  }

  async notifyPendingReleaseInSAP(
    receptionProcess: ReceptionProcess,
    createdBy: User,
  ) {
    const qualityUserIds = await this.qualityUserIds;
    const usersIds = [...qualityUserIds]; // Correcto
    //const usersIds = [createdBy.id]; // TODO: Eliminar esto

    const subscriptions = await this.findSubscriptionsByUserIds(usersIds);

    const eventTime = this.eventTime;

    const { id: receptionProcessId, typeOfMaterial } = receptionProcess;

    const actionConfirm = 'calidad_confima_liberacion_en_sap';

    await Promise.all(
      subscriptions.map((subscription) =>
        this.sendNotification(subscription, {
          title: `Pendiente de liberación en SAP #${receptionProcessId} ⚖️📦`,
          body: `Tipo de material: ${typeOfMaterial}\nUsuario que autorizó: ${createdBy.name}`,
          image: 'img-pending-release.png',
          actions: [
            {
              action: 'confirm',
              title: 'Confirmar',
              icon: `${this.ROOT_IMG_FOLDER}/confirm-icon.webp`,
            },
          ],

          tagId: `pending-release-${receptionProcessId}`,
          requireInteraction: true,
          data: {
            id: receptionProcessId,
            eventTime,
            notifiedUserId: subscription.user.id,
            publicBackendUrl: this.publicBackendUrl,
            appKey: this.appKey,
            actionConfirm,
          },
        }),
      ),
    );
  }

  async notifyProcessFinished(
    receptionProcess: ReceptionProcess,
    createdBy: User,
  ) {
    const logisticsUserIds = await this.logisticsUserIds;
    const qualityUserIds = await this.qualityUserIds;
    const vigilanceUserIds = await this.vigilanceUserIds;
    const productionUserIds = await this.productionUserIds;
    const usersIds = [
      ...logisticsUserIds,
      ...qualityUserIds,
      ...vigilanceUserIds,
      ...productionUserIds,
    ]; // Correcto
    //const usersIds = [createdBy.id]; // TODO: Eliminar esto

    const subscriptions = await this.findSubscriptionsByUserIds(usersIds);

    const eventTime = this.eventTime;

    const { id: receptionProcessId, typeOfMaterial } = receptionProcess;

    await Promise.all(
      subscriptions.map((subscription) =>
        this.sendNotification(subscription, {
          title: `Proceso finalizado #${receptionProcessId} ✅🎉`,
          body: `Tipo de material: ${typeOfMaterial}\nUsuario que autorizó: ${createdBy.name}`,
          image: 'img-process-finished.png',
          tagId: `process-finished-${receptionProcessId}`,
          data: {
            id: receptionProcessId,
            eventTime,
            notifiedUserId: subscription.user.id,
            publicBackendUrl: this.publicBackendUrl,
            appKey: this.appKey,
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
