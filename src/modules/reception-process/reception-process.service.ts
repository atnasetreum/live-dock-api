import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { REQUEST } from '@nestjs/core';

import { Repository } from 'typeorm';

import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { SessionsGateway } from '../sessions/sessions.gateway';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import {
  NotificationEventType,
  NotificationMetric,
  ProcessEvent,
  ProcessEventOption,
  ProcessEventRole,
  ProcessState,
  ReceptionProcess,
} from './entities';
import {
  CreateChangeOfStatusDto,
  CreateNotificationMetricDto,
  CreateReceptionProcessDto,
  UpdateReceptionProcessDto,
} from './dto';

@Injectable()
export class ReceptionProcessService {
  private readonly logger = new Logger(ReceptionProcessService.name);
  private readonly relations = [
    'createdBy',
    'events',
    'events.createdBy',
    'metrics',
    'metrics.createdBy',
  ];

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(ReceptionProcess)
    private readonly receptionProcessRepository: Repository<ReceptionProcess>,
    @InjectRepository(ProcessEvent)
    private readonly processEventRepository: Repository<ProcessEvent>,
    @InjectRepository(NotificationMetric)
    private readonly notificationMetricRepository: Repository<NotificationMetric>,
    private readonly pushNotificationsService: PushNotificationsService,
    private readonly usersService: UsersService,
    private readonly sessionsGateway: SessionsGateway,
  ) {}

  get currentUser() {
    return this.request['user'] as User;
  }

  async notifySocketStateReceptionProcess(id: number) {
    const currentReceptionProcess = await this.findOne(id);

    // ✅ Emitir a tiempo real
    this.sessionsGateway.emitReceptionProcessCreated(currentReceptionProcess);

    return currentReceptionProcess;
  }

  async createProcessEvent({
    receptionProcessId,
    createdBy,
    event,
    status,
    role,
  }: {
    receptionProcessId: number;
    createdBy: User;
    event: ProcessEventOption;
    status: ProcessState;
    role: ProcessEventRole;
  }) {
    const processEvent = await this.processEventRepository.save({
      event,
      status,
      role,
      receptionProcess: {
        id: receptionProcessId,
      },
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return processEvent;
  }

  async create({ typeOfMaterial }: CreateReceptionProcessDto) {
    const createdBy = this.currentUser;

    this.logger.debug(`Creating reception process for user ${createdBy.email}`);

    const receptionProcessNew = await this.receptionProcessRepository.save({
      typeOfMaterial,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const receptionProcessId = receptionProcessNew.id;

    // Registra nuevo evento
    await this.createProcessEvent({
      receptionProcessId,
      createdBy,
      event: ProcessEventOption.VIGILANCIA_REGISTRA_INGRESO,
      status: ProcessState.LOGISTICA_PENDIENTE_DE_CONFIRMACION_INGRESO,
      role: ProcessEventRole.VIGILANCIA,
    });

    const receptionProcess = await this.findOne(receptionProcessId);

    // Notifica la llegada de material
    await this.pushNotificationsService.notifiesOfArrival(receptionProcess);

    // Notifica vía socket el cambio de estado
    return this.notifySocketStateReceptionProcess(receptionProcessId);
  }

  async changeOfStatus(createChangeOfStatusDto: CreateChangeOfStatusDto) {
    const { id: receptionProcessId, actionRole } = createChangeOfStatusDto;

    const createdBy = this.currentUser;

    const receptionProcess = await this.findOne(receptionProcessId);

    switch (actionRole) {
      case 'logistica-autorizo-ingreso':
        // Registra nuevo evento
        await this.createProcessEvent({
          receptionProcessId,
          createdBy,
          event: ProcessEventOption.LOGISTICA_AUTORIZA_INGRESO,
          status: ProcessState.CALIDAD_PENDIENTE_DE_CONFIRMACION_DE_ANALISIS,
          role: ProcessEventRole.LOGISTICA,
        });

        // Notifica a calidad para que realice el análisis
        await this.pushNotificationsService.notifyPendingTest(
          receptionProcess,
          createdBy,
        );
        break;
      case 'calidad-aprobo-material':
        // Registra nuevo evento
        await this.createProcessEvent({
          receptionProcessId,
          createdBy,
          event: ProcessEventOption.CALIDAD_APRUEBA_MATERIAL,
          status:
            ProcessState.PRODUCCION_PENDIENTE_DE_CONFIRMACION_PARA_DESCARGA,
          role: ProcessEventRole.CALIDAD,
        });

        // Notifica qa produccion que el material esta pendiente de descargar
        await this.pushNotificationsService.notifyPendingDownload(
          receptionProcess,
          createdBy,
        );
        break;
      case 'calidad-rechazo-material':
        // Registra nuevo evento
        await this.createProcessEvent({
          receptionProcessId,
          createdBy,
          event: ProcessEventOption.CALIDAD_RECHAZA_MATERIAL,
          status: ProcessState.FINALIZO_PROCESO_POR_RECHAZO,
          role: ProcessEventRole.CALIDAD,
        });

        // Notifica que calidad rechazó el material
        await this.pushNotificationsService.notifyTestRejected(
          receptionProcess,
          createdBy,
        );
        break;
      case 'produccion-descargando':
        // Registra nuevo evento
        await this.createProcessEvent({
          receptionProcessId,
          createdBy,
          event: ProcessEventOption.PRODUCCION_INICIA_DESCARGA,
          status: ProcessState.PRODUCCION_DESCARGANDO,
          role: ProcessEventRole.PRODUCCION,
        });
        break;
      case 'descargado':
        // Registra nuevo evento
        await this.createProcessEvent({
          receptionProcessId,
          createdBy,
          event: ProcessEventOption.PRODUCCION_FINALIZA_DESCARGA,
          status:
            ProcessState.LOGISTICA_PENDIENTE_DE_CONFIRMACION_CAPTURA_PESO_SAP,
          role: ProcessEventRole.PRODUCCION,
        });

        // Notifica a logistica, pendiente de peso en sap
        await this.pushNotificationsService.notifyPendingWeightInSAP(
          receptionProcess,
          createdBy,
        );
        break;
      case 'logistica-capturo-peso-sap':
        // Registra nuevo evento
        await this.createProcessEvent({
          receptionProcessId,
          createdBy,
          event: ProcessEventOption.LOGISTICA_CAPTURA_DE_PESO_EN_SAP,
          status: ProcessState.CALIDAD_PENDIENTE_CONFIRMACION_LIBERACION_SAP,
          role: ProcessEventRole.LOGISTICA,
        });

        // Notifica a calidad, pendiente de liberación en sap
        await this.pushNotificationsService.notifyPendingReleaseInSAP(
          receptionProcess,
          createdBy,
        );
        break;
      case 'calidad-libero-sap':
        // Registra nuevo evento
        await this.createProcessEvent({
          receptionProcessId,
          createdBy,
          event: ProcessEventOption.CALIDAD_LIBERA_EN_SAP,
          status: ProcessState.FINALIZO_PROCESO,
          role: ProcessEventRole.CALIDAD,
        });

        // Notifica que el proceso finalizó correctamente
        await this.pushNotificationsService.notifyProcessFinished(
          receptionProcess,
          createdBy,
        );

        break;
    }

    // Notifica vía socket el cambio de estado
    return this.notifySocketStateReceptionProcess(receptionProcessId);
  }

  async createMetric(createNotificationMetricDto: CreateNotificationMetricDto) {
    const {
      id: receptionProcessId,
      visibleAt,
      eventType,
      notifiedUserId,
      accionAt,
      reactionTimeSec,
      systemDelaySec,
      metadata,
      actionConfirm,
    } = createNotificationMetricDto;

    const receptionProcess = await this.findOne(receptionProcessId);

    const createdBy = await this.usersService.findOne(notifiedUserId);

    this.logger.debug(
      `Creating notification metric for user ${createdBy.email} and reception process id: ${receptionProcessId}`,
    );

    await this.notificationMetricRepository.save({
      eventType,
      visibleAt,
      receptionProcess,
      ...(accionAt && { actionAt: accionAt }),
      ...(reactionTimeSec && { reactionTimeSec }),
      ...(systemDelaySec !== undefined && { systemDelaySec }),
      metadata: JSON.parse(metadata) as Record<string, any>,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (
      [
        NotificationEventType.EXPIRED,
        NotificationEventType.NOTIFICATION_CLICKED_NOT_ACTION,
      ].includes(eventType)
    ) {
      switch (actionConfirm) {
        case 'logistica_confirma_ingreso':
          // Notifica la llegada de material
          await this.pushNotificationsService.notifiesOfArrival(
            receptionProcess,
            createdBy,
          );
          break;
        case 'calidad_confirma_test':
          // Notifica a calidad para que realice el análisis
          await this.pushNotificationsService.notifyPendingTest(
            receptionProcess,
            createdBy,
          );
          break;
        case 'produccion_confirma_descarga':
          // Notifica a produccion que el material esta pendiente de descargar
          await this.pushNotificationsService.notifyPendingDownload(
            receptionProcess,
            createdBy,
          );
          break;
        case 'logistica_confirma_pendiente_peso_en_sap':
          // Notifica a logistica, pendiente de peso en sap
          await this.pushNotificationsService.notifyPendingWeightInSAP(
            receptionProcess,
            createdBy,
          );
          break;
        case 'calidad_confima_liberacion_en_sap':
          // Notifica a calidad, pendiente de liberación en sap
          await this.pushNotificationsService.notifyPendingReleaseInSAP(
            receptionProcess,
            createdBy,
          );
          break;
      }

      return {
        message: `No action taken for event type ${eventType} with actionConfirm ${actionConfirm}`,
      };
    }

    if (eventType === NotificationEventType.ACTION_CLICKED_CONFIRM) {
      switch (actionConfirm) {
        case 'logistica_confirma_ingreso':
          // Registra nuevo evento
          await this.createProcessEvent({
            receptionProcessId,
            createdBy,
            event: ProcessEventOption.LOGISTICA_CONFIRMA_PENDIENTE_DE_INGRESO,
            status: ProcessState.LOGISTICA_PENDIENTE_DE_AUTORIZACION,
            role: ProcessEventRole.LOGISTICA,
          });
          break;
        case 'calidad_confirma_test':
          // Registra nuevo evento
          await this.createProcessEvent({
            receptionProcessId,
            createdBy,
            event: ProcessEventOption.CALIDAD_CONFIRMA_PENDIENTE_DE_ANALISIS,
            status: ProcessState.CALIDAD_PROCESANDO,
            role: ProcessEventRole.CALIDAD,
          });
          break;
        case 'produccion_confirma_descarga':
          // Registra nuevo evento
          await this.createProcessEvent({
            receptionProcessId,
            createdBy,
            event: ProcessEventOption.PRODUCCION_CONFIRMA_PENDIENTE_DE_DESCARGA,
            status: ProcessState.PRODUCCION_PENDIENTE_DE_DESCARGA,
            role: ProcessEventRole.PRODUCCION,
          });
          break;
        case 'logistica_confirma_pendiente_peso_en_sap':
          // Registra nuevo evento
          await this.createProcessEvent({
            receptionProcessId,
            createdBy,
            event: ProcessEventOption.LOGISTICA_CONFIRMA_CAPTURA_DE_PESO_EN_SAP,
            status: ProcessState.LOGISTICA_PENDIENTE_DE_CAPTURA_PESO_SAP,
            role: ProcessEventRole.LOGISTICA,
          });
          break;
        case 'calidad_confima_liberacion_en_sap':
          // Registra nuevo evento
          await this.createProcessEvent({
            receptionProcessId,
            createdBy,
            event:
              ProcessEventOption.CALIDAD_CONFIRMA_PENDIENTE_DE_LIBERACION_EN_SAP,
            status: ProcessState.CALIDAD_PENDIENTE_LIBERACION_EN_SAP,
            role: ProcessEventRole.CALIDAD,
          });
          break;
      }
    }

    return this.notifySocketStateReceptionProcess(receptionProcessId);
  }

  findAll() {
    return this.receptionProcessRepository.find({
      where: { isActive: true },
      relations: this.relations,
      order: {
        createdAt: 'DESC',
        events: {
          id: 'ASC',
        },
      },
    });
  }

  async findOne(id: number) {
    const receptionProcess = await this.receptionProcessRepository.findOne({
      where: { id },
      relations: this.relations,
      select: {
        metrics: {
          id: true,
          eventType: true,
          visibleAt: true,
          actionAt: true,
          reactionTimeSec: true,
          systemDelaySec: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      order: {
        events: {
          id: 'ASC',
        },
        metrics: {
          id: 'ASC',
        },
      },
    });

    if (!receptionProcess) {
      throw new NotFoundException(`ReceptionProcess with id ${id} not found`);
    }

    return receptionProcess;
  }

  update(id: number, updateReceptionProcessDto: UpdateReceptionProcessDto) {
    return { id, updateReceptionProcessDto };
  }

  remove(id: number) {
    return `This action removes a #${id} receptionProcess`;
  }
}
