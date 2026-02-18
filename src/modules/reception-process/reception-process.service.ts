import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { REQUEST } from '@nestjs/core';

import { MoreThanOrEqual, Repository } from 'typeorm';

import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { SessionsGateway } from '../sessions/sessions.gateway';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import {
  NotificationEventType,
  NotificationMetric,
  PriorityAlert,
  PriorityAlertRole,
  PriorityAlertSeverity,
  ProcessEvent,
  ProcessEventOption,
  ProcessEventRole,
  ProcessState,
  ReceptionProcess,
  ReceptionProcessStatus,
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
    @InjectRepository(PriorityAlert)
    private readonly priorityAlertRepository: Repository<PriorityAlert>,
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
    const receptionProcess = await this.findOne(id);

    // ✅ Emitir a tiempo real
    this.sessionsGateway.emitStatusReceptionProcess(receptionProcess);

    return receptionProcess;
  }

  async priorityAlerts(
    roles: ProcessEventRole[],
    data: {
      receptionProcessId: number;
      title: string;
      detail: string;
      severity: PriorityAlertSeverity;
      disableGroup?: boolean;
    },
  ) {
    const createdBy = this.currentUser;

    let userIds: number[] = [];

    if (data?.disableGroup) {
      await this.priorityAlertRepository.update(
        {
          receptionProcess: {
            id: data.receptionProcessId,
          },
          isActive: true,
        },
        {
          isActive: false,
          updatedAt: new Date(),
        },
      );
    }

    for (const role of roles) {
      switch (role) {
        case ProcessEventRole.LOGISTICA:
          userIds = await this.pushNotificationsService.logisticsUserIds;
          break;
        case ProcessEventRole.CALIDAD:
          userIds = await this.pushNotificationsService.qualityUserIds;
          break;
        case ProcessEventRole.PRODUCCION:
          userIds = await this.pushNotificationsService.productionUserIds;
          break;
        case ProcessEventRole.VIGILANCIA:
          userIds = await this.pushNotificationsService.vigilanceUserIds;
          break;
      }

      //userIds = [1]; // TODO: Eliminar esta línea, solo para pruebas

      await this.priorityAlertRepository.save({
        role: role as unknown as PriorityAlertRole,
        title: data.title,
        detail: data.detail,
        severity: data.severity,
        receptionProcess: {
          id: data.receptionProcessId,
        },
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.sessionsGateway.emitEventToRoles(
        `${role}:events-process-updated`,
        data,
        userIds,
      );
    }
  }

  async findPriorityAlerts(startDate?: string) {
    const currentUser = this.currentUser;

    const role = currentUser.role as unknown as PriorityAlertRole;

    return this.priorityAlertRepository.find({
      where: {
        isActive: true,
        role,
        ...(startDate && { createdAt: MoreThanOrEqual(new Date(startDate)) }),
      },
      order: {
        createdAt: 'DESC',
      },
    });
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
    if (event !== ProcessEventOption.VIGILANCIA_REGISTRA_INGRESO) {
      const receptionProcess = await this.findOne(receptionProcessId);

      const orderedSteps = {
        1: ProcessEventOption.LOGISTICA_CONFIRMA_PENDIENTE_DE_INGRESO,
        2: ProcessEventOption.LOGISTICA_AUTORIZA_INGRESO,
        3: ProcessEventOption.CALIDAD_CONFIRMA_PENDIENTE_DE_ANALISIS,
        4: ProcessEventOption.CALIDAD_RECHAZA_MATERIAL,
        5: ProcessEventOption.CALIDAD_APRUEBA_MATERIAL,
        6: ProcessEventOption.PRODUCCION_CONFIRMA_PENDIENTE_DE_DESCARGA,
        7: ProcessEventOption.PRODUCCION_INICIA_DESCARGA,
        8: ProcessEventOption.PRODUCCION_FINALIZA_DESCARGA,
        9: ProcessEventOption.LOGISTICA_CONFIRMA_CAPTURA_DE_PESO_EN_SAP,
        10: ProcessEventOption.LOGISTICA_CAPTURA_DE_PESO_EN_SAP,
        11: ProcessEventOption.CALIDAD_CONFIRMA_PENDIENTE_DE_LIBERACION_EN_SAP,
        12: ProcessEventOption.CALIDAD_LIBERA_EN_SAP,
      };

      if (event === ProcessEventOption.CALIDAD_APRUEBA_MATERIAL) {
        // Se elimina el paso 4, Reordenar las claves para que no haya saltos
        const reorderedSteps: Record<number, ProcessEventOption> = {};
        let index = 1;
        for (const key in orderedSteps) {
          if (
            key !== '4' &&
            orderedSteps[key] !== ProcessEventOption.CALIDAD_RECHAZA_MATERIAL
          ) {
            reorderedSteps[index] = orderedSteps[key] as ProcessEventOption;
            index++;
          }
        }

        Object.assign(orderedSteps, reorderedSteps);
      }

      const lastStatus =
        receptionProcess.events[receptionProcess.events.length - 1]?.status ||
        '';

      console.log({ event, lastStatus });

      if (lastStatus === status) {
        throw new ConflictException(
          `The reception process is already in status ${status}`,
        );
      }

      // Validación de flujo correcto de eventos
      const lastEvent =
        receptionProcess.events[receptionProcess.events.length - 1]?.event ||
        '';

      if (event !== orderedSteps[Object.keys(orderedSteps).length]) {
        const currentKeyIndex = Object.keys(orderedSteps).find(
          (key) => orderedSteps[key] === lastEvent,
        );

        if (currentKeyIndex !== undefined) {
          const expectedEvent = orderedSteps[Number(currentKeyIndex) + 1] as
            | ProcessEventOption
            | undefined;

          if (expectedEvent && event !== expectedEvent) {
            throw new ConflictException(
              `The next event should be ${expectedEvent} after ${lastEvent}`,
            );
          }
        }
      }
    }

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

    //Notifica por socket evento
    await this.priorityAlerts([ProcessEventRole.LOGISTICA], {
      receptionProcessId,
      title: `Ingreso de pipa #${receptionProcessId} 🚛➡️🏭`,
      detail: `Tipo de Material: ${typeOfMaterial}.`,
      severity: PriorityAlertSeverity.ALTA,
    });

    // Notifica vía socket el cambio de estado
    return this.notifySocketStateReceptionProcess(receptionProcessId);
  }

  async endReceptionProcess(
    receptionProcess: ReceptionProcess,
    status:
      | ReceptionProcessStatus.FINALIZADO
      | ReceptionProcessStatus.RECHAZADO,
  ) {
    await this.update(receptionProcess.id, {
      status,
      processingTimeMinutes: Math.round(
        (new Date().getTime() - receptionProcess.createdAt.getTime()) / 60000,
      ),
    });
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

        //Notifica por socket evento
        await this.priorityAlerts([ProcessEventRole.CALIDAD], {
          receptionProcessId,
          title: `Pendiente de evaluacion #${receptionProcessId} 🧪🔍`,
          detail: `Tipo de Material: ${receptionProcess.typeOfMaterial}.`,
          severity: PriorityAlertSeverity.ALTA,
        });
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

        //Notifica por socket evento
        await this.priorityAlerts([ProcessEventRole.PRODUCCION], {
          receptionProcessId,
          title: `Pendiente de descarga #${receptionProcessId} 📦⬇️`,
          detail: `Tipo de Material: ${receptionProcess.typeOfMaterial}.`,
          severity: PriorityAlertSeverity.ALTA,
        });
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

        //Notifica por socket evento
        await this.priorityAlerts(
          [
            ProcessEventRole.VIGILANCIA,
            ProcessEventRole.PRODUCCION,
            ProcessEventRole.LOGISTICA,
            ProcessEventRole.CALIDAD,
          ],
          {
            receptionProcessId,
            title: `Rechazado por calidad #${receptionProcessId} ❌🧪`,
            detail: `Tipo de Material: ${receptionProcess.typeOfMaterial}.`,
            severity: PriorityAlertSeverity.BAJA,
            disableGroup: true,
          },
        );

        // Actualiza estado a finalizado y calcula tiempo de proceso
        await this.endReceptionProcess(
          receptionProcess,
          ReceptionProcessStatus.RECHAZADO,
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

        //Notifica por socket evento
        await this.priorityAlerts([ProcessEventRole.LOGISTICA], {
          receptionProcessId,
          title: `Pendiente de peso en SAP #${receptionProcessId} ⚖️📦`,
          detail: `Tipo de Material: ${receptionProcess.typeOfMaterial}.`,
          severity: PriorityAlertSeverity.ALTA,
        });
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

        //Notifica por socket evento
        await this.priorityAlerts([ProcessEventRole.CALIDAD], {
          receptionProcessId,
          title: `Pendiente de liberación en SAP #${receptionProcessId} ⚖️📦`,
          detail: `Tipo de Material: ${receptionProcess.typeOfMaterial}.`,
          severity: PriorityAlertSeverity.ALTA,
        });
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

        // Actualiza estado a finalizado y calcula tiempo de proceso
        await this.endReceptionProcess(
          receptionProcess,
          ReceptionProcessStatus.FINALIZADO,
        );

        // Notifica que el proceso finalizó correctamente
        await this.pushNotificationsService.notifyProcessFinished(
          receptionProcess,
          createdBy,
        );

        //Notifica por socket evento
        await this.priorityAlerts(
          [
            ProcessEventRole.VIGILANCIA,
            ProcessEventRole.PRODUCCION,
            ProcessEventRole.LOGISTICA,
            ProcessEventRole.CALIDAD,
          ],
          {
            receptionProcessId,
            title: `Proceso finalizado #${receptionProcessId} ✅🎉`,
            detail: `Tipo de Material: ${receptionProcess.typeOfMaterial}.`,
            severity: PriorityAlertSeverity.BAJA,
            disableGroup: true,
          },
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

    const lastEvent =
      receptionProcess.events[receptionProcess.events.length - 1].event;

    if (
      [
        NotificationEventType.EXPIRED,
        NotificationEventType.NOTIFICATION_CLICKED_NOT_ACTION,
      ].includes(eventType) &&
      !lastEvent.includes('CONFIRMA')
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

    const lastStatus =
      receptionProcess.events[receptionProcess.events.length - 1].status;

    if (eventType === NotificationEventType.ACTION_CLICKED_CONFIRM) {
      switch (actionConfirm) {
        case 'logistica_confirma_ingreso':
          if (lastStatus === ProcessState.LOGISTICA_PENDIENTE_DE_AUTORIZACION) {
            return {
              message: `No action taken because the process is still pending authorization by logistics`,
            };
          }
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
          if (lastStatus === ProcessState.CALIDAD_PROCESANDO) {
            return {
              message: `No action taken because the process is still pending analysis confirmation by quality`,
            };
          }

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
          if (lastStatus === ProcessState.PRODUCCION_PENDIENTE_DE_DESCARGA) {
            return {
              message: `No action taken because the process is still pending download confirmation by production`,
            };
          }

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
          if (
            lastStatus === ProcessState.LOGISTICA_PENDIENTE_DE_CAPTURA_PESO_SAP
          ) {
            return {
              message: `No action taken because the process is still pending weight capture confirmation in SAP by logistics`,
            };
          }

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
          if (lastStatus === ProcessState.CALIDAD_PENDIENTE_LIBERACION_EN_SAP) {
            return {
              message: `No action taken because the process is still pending release confirmation in SAP by quality`,
            };
          }

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

  findAll({ startDate }: { startDate?: string }) {
    return this.receptionProcessRepository.find({
      where: {
        isActive: true,
        ...(startDate && { createdAt: MoreThanOrEqual(new Date(startDate)) }),
      },
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

  async update(
    id: number,
    updateReceptionProcessDto: UpdateReceptionProcessDto,
  ) {
    await this.findOne(id);

    const { status, processingTimeMinutes, ...rest } =
      updateReceptionProcessDto;

    await this.receptionProcessRepository.update(id, {
      ...rest,
      ...(status && { status }),
      ...(processingTimeMinutes && { processingTimeMinutes }),
      updatedAt: new Date(),
    });

    return this.findOne(id);
  }

  remove(id: number) {
    return `This action removes a #${id} receptionProcess`;
  }
}
