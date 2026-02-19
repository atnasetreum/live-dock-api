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

  @Cron('*/10 * * * * *') // TODO: Eliminar esto
  //@Cron('0 */5 * * * *')
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
      relations: ['events', 'events.createdBy'],
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
      const createdBy = lastEvent.createdBy;

      if (
        currentStatus.includes('PENDIENTE_DE_CONFIRMACION') &&
        lastEvent.createdAt <= threshold
      ) {
        // Use logger as requested for the alert.
        this.logger.warn(
          `Pending confirmation alert for process ${process.id}`,
        );

        switch (currentStatus) {
          case ProcessState.LOGISTICA_PENDIENTE_DE_CONFIRMACION_INGRESO:
            // Notifica la llegada de material
            await this.pushNotificationsService.notifiesOfArrival(process);
            break;
          case ProcessState.CALIDAD_PENDIENTE_DE_CONFIRMACION_DE_ANALISIS:
            // Notifica a calidad para que realice el análisis
            await this.pushNotificationsService.notifyPendingTest(
              process,
              createdBy,
            );
            break;
          case ProcessState.PRODUCCION_PENDIENTE_DE_CONFIRMACION_PARA_DESCARGA:
            // Notifica qa produccion que el material esta pendiente de descargar
            await this.pushNotificationsService.notifyPendingDownload(
              process,
              createdBy,
            );
            break;
          case ProcessState.LOGISTICA_PENDIENTE_DE_CONFIRMACION_CAPTURA_PESO_SAP:
            // Notifica a logistica, pendiente de peso en sap
            await this.pushNotificationsService.notifyPendingWeightInSAP(
              process,
              createdBy,
            );
            break;
        }
      }
    }
  }
}
