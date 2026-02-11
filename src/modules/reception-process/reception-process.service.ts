import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { REQUEST } from '@nestjs/core';

import { Repository } from 'typeorm';

import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import {
  NotificationEventType,
  NotificationMetric,
  ReceptionProcess,
} from './entities';
import { User } from '../users/entities/user.entity';
import {
  CreateNotificationMetricDto,
  CreateReceptionProcessDto,
  UpdateReceptionProcessDto,
} from './dto';
import { UsersService } from '../users/users.service';

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
    @InjectRepository(NotificationMetric)
    private readonly notificationMetricRepository: Repository<NotificationMetric>,
    private readonly pushNotificationsService: PushNotificationsService,
    private readonly usersService: UsersService,
  ) {}

  get currentUser() {
    return this.request['user'] as User;
  }

  async create(createReceptionProcessDto: CreateReceptionProcessDto) {
    const currentUser = this.currentUser;

    this.logger.debug(
      `Creating reception process for user ${currentUser.email}`,
    );

    const { typeOfMaterial } = createReceptionProcessDto;

    const receptionProcessNew = await this.receptionProcessRepository.save({
      typeOfMaterial,
      createdBy: currentUser,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const receptionProcess = await this.findOne(receptionProcessNew.id);

    await this.pushNotificationsService.createReceptionProcessNotification(
      receptionProcess,
    );

    return receptionProcess;
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
      eventType === NotificationEventType.EXPIRED &&
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
