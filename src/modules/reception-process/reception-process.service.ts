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

  async create(createReceptionProcessDto: CreateReceptionProcessDto) {
    const createdBy = this.currentUser;

    this.logger.debug(`Creating reception process for user ${createdBy.email}`);

    const { typeOfMaterial } = createReceptionProcessDto;

    const receptionProcessNew = await this.receptionProcessRepository.save({
      typeOfMaterial,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const id = receptionProcessNew.id;

    await this.processEventRepository.save({
      event: ProcessEventOption.VIGILANCIA_REGISTRA_INGRESO,
      status: ProcessState.VIGILANCIA_REGISTRO_INGRESO,
      role: ProcessEventRole.VIGILANCIA,
      receptionProcess: {
        id,
      },
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const receptionProcess = await this.findOne(id);

    await this.pushNotificationsService.createReceptionProcessNotification(
      receptionProcess,
    );

    await this.processEventRepository.save({
      event: ProcessEventOption.SISTEMA_CAMBIA_ESTATUS,
      status: ProcessState.LOGISTICA_PENDIENTE_DE_CONFIRMACION_INGRESO,
      role: ProcessEventRole.SISTEMA,
      receptionProcess: {
        id,
      },
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.notifySocketStateReceptionProcess(id);
  }

  async createMetric(createNotificationMetricDto: CreateNotificationMetricDto) {
    const {
      id,
      visibleAt,
      eventType,
      notifiedUserId,
      accionAt,
      reactionTimeSec,
      systemDelaySec,
      metadata,
      nextEvent,
    } = createNotificationMetricDto;

    const createdBy = await this.usersService.findOne(notifiedUserId);

    this.logger.debug(
      `Creating notification metric for user ${createdBy.email} and reception process ${id}`,
    );

    const receptionProcess = await this.findOne(id);

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
      ].includes(eventType) &&
      !receptionProcess.metrics.some(
        (metric) =>
          metric.eventType === NotificationEventType.ACTION_CLICKED_CONFIRM,
      )
    ) {
      await this.pushNotificationsService.createReceptionProcessNotification(
        receptionProcess,
        createdBy,
      );
    }

    if (NotificationEventType.ACTION_CLICKED_CONFIRM && nextEvent) {
      const { event, statusProcess, eventRole } = nextEvent;
      await this.processEventRepository.save({
        event: ProcessEventOption[event],
        status: ProcessState[statusProcess],
        role: ProcessEventRole[eventRole],
        receptionProcess: {
          id,
        },
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return this.notifySocketStateReceptionProcess(id);
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
    const { id, newState, nextEvent, actionRole } = createChangeOfStatusDto;

    const createdBy = this.currentUser;

    await this.findOne(id);

    const { event, statusProcess, eventRole } = nextEvent;

    let eventCreated: ProcessEvent;

    switch (newState) {
      case 'autorizada':
        eventCreated = await this.processEventRepository.save({
          event: ProcessEventOption[event],
          status: ProcessState[statusProcess],
          role: ProcessEventRole[eventRole],
          receptionProcess: {
            id,
          },
          createdBy,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        break;
      default:
        throw new NotFoundException(
          `The new state ${newState} is not valid for change of status`,
        );
    }

    const receptionProcess = await this.notifySocketStateReceptionProcess(id);

    switch (actionRole) {
      case 'logistica-autorizo-ingreso':
        await this.pushNotificationsService.createPendingForTestingNotification(
          receptionProcess,
          eventCreated.createdBy,
        );
        break;
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
