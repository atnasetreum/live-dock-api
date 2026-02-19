import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';

import { Repository } from 'typeorm';

import {
  ProcessState,
  ReceptionProcess,
  ReceptionProcessStatus,
} from './entities';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';

@Injectable()
export class ReceptionProcessCronService {
  private readonly alertThresholdMinutes = 1;
  private readonly logger = new Logger(ReceptionProcessCronService.name);

  constructor(
    @InjectRepository(ReceptionProcess)
    private readonly receptionProcessRepository: Repository<ReceptionProcess>,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {
    this.logger.log(
      `ReceptionProcessCronService initialized with alert threshold of ${this.alertThresholdMinutes} minutes`,
    );
  }

  @Cron('*/10 * * * * *')
  async logPendingConfirmations() {
    const threshold = new Date(
      Date.now() - this.alertThresholdMinutes * 60 * 1000,
    );

    this.logger.debug(`Running evaluation of pending confirmations...`);

    const processes = await this.receptionProcessRepository.find({
      where: {
        isActive: true,
        status: ReceptionProcessStatus.EN_PROGRESO,
      },
      relations: ['events'],
      order: {
        events: {
          createdAt: 'ASC',
        },
      },
    });

    for (const process of processes) {
      const lastEvent = process.events[process.events.length - 1];

      if (!lastEvent) {
        continue;
      }

      const currentStatus = lastEvent.status;

      if (
        currentStatus.includes('PENDIENTE_DE_CONFIRMACION') &&
        lastEvent.createdAt <= threshold
      ) {
        // Use logger as requested for the alert.
        this.logger.warn(
          `Pending confirmation alert for process ${process.id}`,
        );

        if (
          currentStatus ===
          ProcessState.LOGISTICA_PENDIENTE_DE_CONFIRMACION_INGRESO
        ) {
          console.log('Notifica de nuevo');
          await this.pushNotificationsService.notifiesOfArrival(process);
        }
      }
    }
  }
}
