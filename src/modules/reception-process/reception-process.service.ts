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
      status: ProcessState.VIGILANCIA_REGISTRO_INGRESO,
      role: ProcessEventRole.VIGILANCIA,
    });

    const receptionProcess = await this.findOne(receptionProcessId);

    // Notifica la llegada de material
    await this.pushNotificationsService.notifiesOfArrival(receptionProcess);

    // Registra nuevo evento
    await this.createProcessEvent({
      receptionProcessId,
      createdBy,
      event: ProcessEventOption.SISTEMA_CAMBIA_ESTATUS,
      status: ProcessState.LOGISTICA_PENDIENTE_DE_CONFIRMACION_INGRESO,
      role: ProcessEventRole.SISTEMA,
    });

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
      }

      return {
        message: `No action taken for event type ${eventType} with actionConfirm ${actionConfirm}`,
      };
    }

    if (NotificationEventType.ACTION_CLICKED_CONFIRM) {
      switch (actionConfirm) {
        case 'logistica_confirma_ingreso':
          // Registra nuevo evento
          await this.createProcessEvent({
            receptionProcessId,
            createdBy,
            event: ProcessEventOption.LOGISTICA_AUTORIZA_INGRESO,
            status: ProcessState.CALIDAD_PENDIENTE_DE_CONFIRMACION_DE_ANALISIS,
            role: ProcessEventRole.LOGISTICA,
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
          status: ProcessState.CALIDAD_APROBO,
          role: ProcessEventRole.CALIDAD,
        });
        // TODO: Este es el siguiente paso
        break;
      case 'calidad-rechazo-material':
        // Registra nuevo evento
        await this.createProcessEvent({
          receptionProcessId,
          createdBy,
          event: ProcessEventOption.CALIDAD_RECHAZA_MATERIAL,
          status: ProcessState.CALIDAD_RECHAZO,
          role: ProcessEventRole.CALIDAD,
        });

        // Notifica que calidad rechazó el material
        await this.pushNotificationsService.notifyTestRejected(
          receptionProcess,
          createdBy,
        );
        break;
    }

    // Notifica vía socket el cambio de estado
    return this.notifySocketStateReceptionProcess(receptionProcessId);
  }

  update(id: number, updateReceptionProcessDto: UpdateReceptionProcessDto) {
    return { id, updateReceptionProcessDto };
  }

  remove(id: number) {
    return `This action removes a #${id} receptionProcess`;
  }
}
