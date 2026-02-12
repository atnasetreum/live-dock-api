import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { REQUEST } from '@nestjs/core';

import { Repository } from 'typeorm';

import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { SessionsGateway } from '../sessions/sessions.gateway';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import {
  Event,
  NotificationEventType,
  NotificationMetric,
  ProcessEvent,
  ProcessEventRole,
  ProcessState,
  ReceptionProcess,
} from './entities';
import {
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
      event: Event.REGISTRA_INGRESO,
      status: ProcessState.REGISTRADA,
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
      event: Event.CAMBIO_ESTADO,
      status: ProcessState.PENDIENTE_CONFIRMACION,
      role: ProcessEventRole.SISTEMA,
      receptionProcess: {
        id,
      },
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const currentReceptionProcess = await this.findOne(id);

    // ✅ Emitir a tiempo real
    this.sessionsGateway.emitReceptionProcessCreated(currentReceptionProcess);

    return currentReceptionProcess;
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
      eventRole,
      statusProcess,
    } = createNotificationMetricDto;

    const createdBy = await this.usersService.findOne(notifiedUserId);

    this.logger.debug(
      `Creating notification metric for user ${createdBy.email} and reception process ${id}`,
    );

    const receptionProcess = await this.findOne(id);

    const notificationMetricNew = await this.notificationMetricRepository.save({
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

    if (
      NotificationEventType.ACTION_CLICKED_CONFIRM &&
      statusProcess &&
      eventRole
    ) {
      await this.processEventRepository.save({
        event: Event.CONFIRMA_NOTIFICACION,
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

    const currentReceptionProcess = await this.findOne(id);

    // ✅ Emitir a tiempo real
    this.sessionsGateway.emitReceptionProcessCreated(currentReceptionProcess);

    return notificationMetricNew;
  }

  findAll() {
    return this.receptionProcessRepository.find({
      where: { isActive: true },
      relations: this.relations,
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
        metrics: {
          createdAt: 'ASC',
        },
        events: {
          createdAt: 'ASC',
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
