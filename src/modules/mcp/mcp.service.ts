import { InjectRepository } from '@nestjs/typeorm';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import * as argon2 from 'argon2';
import { Repository } from 'typeorm';

import { JwtService } from 'src/auth';
import { User } from 'src/modules/users/entities/user.entity';
import {
  NotificationMetric,
  ProcessEvent,
  ProcessEventRole,
  ReceptionProcess,
} from 'src/modules/reception-process/entities';
import {
  GetBottleneckSnapshotDto,
  GetDelaysByRoleDto,
  McpLoginDto,
} from './dto';
import { GetRejectionFunnelDto } from './dto/get-rejection-funnel.dto';
import { GetRoleWorkloadAndPerformanceDto } from './dto/get-role-workload-and-performance.dto';
import { GetUserNotificationEffectivenessDto } from './dto/get-user-notification-effectiveness.dto';

type DelayByRoleRow = {
  role: string;
  totalMetrics: string;
  averageReactionTimeSec: string | null;
  averageSystemDelaySec: string | null;
  maxReactionTimeSec: string | null;
  maxSystemDelaySec: string | null;
};

type BottleneckByRoleRow = {
  role: string;
  totalProcesses: string;
  avgMinutesSinceLastEvent: string;
  maxMinutesSinceLastEvent: string;
};

type OldestProcessRow = {
  receptionProcessId: string;
  providerName: string;
  licensePlates: string;
  role: string;
  status: string;
  minutesSinceLastEvent: string;
  lastEventAt: Date;
};

type ActiveUsersByRoleRow = {
  role: string;
  activeUsers: string;
};

type EventVolumeByRoleRow = {
  role: string;
  totalEvents: string;
};

type MetricPerformanceByRoleRow = {
  role: string;
  totalMetrics: string;
  averageReactionTimeSec: string | null;
  maxReactionTimeSec: string | null;
  averageSystemDelaySec: string | null;
  maxSystemDelaySec: string | null;
};

type RejectionFunnelRow = {
  role: string;
  status: string;
  event: string;
  rejectedProcesses: string;
};

type UserNotificationEffectivenessRow = {
  userId: string;
  name: string;
  email: string;
  role: string;
  totalNotifications: string;
  totalShown: string;
  totalConfirmed: string;
  totalClosed: string;
  totalClickedOutsideAction: string;
  avgReactionTimeSec: string | null;
  maxReactionTimeSec: string | null;
};

type DistinctRoleRow = {
  role: string;
};

type DistinctEventTypeRow = {
  eventType: string;
};

@Injectable()
export class McpService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(NotificationMetric)
    private readonly notificationMetricRepository: Repository<NotificationMetric>,
    @InjectRepository(ProcessEvent)
    private readonly processEventRepository: Repository<ProcessEvent>,
    @InjectRepository(ReceptionProcess)
    private readonly receptionProcessRepository: Repository<ReceptionProcess>,
    private readonly jwtService: JwtService,
  ) {}

  async login({ username, password }: McpLoginDto) {
    const normalizedUsername = username.trim().toLowerCase();

    const user = await this.userRepository.findOne({
      where: {
        email: normalizedUsername,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        password: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        `Usuario con el correo ${normalizedUsername} no encontrado`,
      );
    }

    if (!(await argon2.verify(user.password, password))) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    return {
      accessToken: this.jwtService.create(user.id),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      scope: 'read-only',
    };
  }

  async getDelaysByRole({
    startDate,
    endDate,
    role,
    eventType,
  }: GetDelaysByRoleDto) {
    const query = this.notificationMetricRepository
      .createQueryBuilder('metric')
      .innerJoin('metric.createdBy', 'user')
      .select('user.role', 'role')
      .addSelect('COUNT(metric.id)', 'totalMetrics')
      .addSelect('AVG(metric.reactionTimeSec)', 'averageReactionTimeSec')
      .addSelect('AVG(metric.systemDelaySec)', 'averageSystemDelaySec')
      .addSelect('MAX(metric.reactionTimeSec)', 'maxReactionTimeSec')
      .addSelect('MAX(metric.systemDelaySec)', 'maxSystemDelaySec')
      .where('metric.isActive = :isActive', { isActive: true })
      .groupBy('user.role')
      .orderBy('user.role', 'ASC');

    if (startDate) {
      query.andWhere('metric.createdAt >= :startDate', {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      query.andWhere('metric.createdAt <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    if (role) {
      query.andWhere('user.role = :role', { role });
    }

    if (eventType) {
      query.andWhere('metric.eventType = :eventType', { eventType });
    }

    const rows = await query.getRawMany<DelayByRoleRow>();

    return {
      filters: {
        startDate: startDate ?? null,
        endDate: endDate ?? null,
        role: role ?? null,
        eventType: eventType ?? null,
      },
      data: rows.map((row) => ({
        role: row.role,
        totalMetrics: Number(row.totalMetrics),
        averageReactionTimeSec:
          row.averageReactionTimeSec === null
            ? null
            : Number(row.averageReactionTimeSec),
        averageSystemDelaySec:
          row.averageSystemDelaySec === null
            ? null
            : Number(row.averageSystemDelaySec),
        maxReactionTimeSec:
          row.maxReactionTimeSec === null
            ? null
            : Number(row.maxReactionTimeSec),
        maxSystemDelaySec:
          row.maxSystemDelaySec === null ? null : Number(row.maxSystemDelaySec),
      })),
    };
  }

  async getBottleneckSnapshot({
    startDate,
    endDate,
  }: GetBottleneckSnapshotDto) {
    const normalizedStartDate =
      typeof startDate === 'string' ? startDate : undefined;
    const normalizedEndDate = typeof endDate === 'string' ? endDate : undefined;

    const latestEventSubquery = this.processEventRepository.manager
      .createQueryBuilder()
      .from('process_events', 'pe')
      .select('pe."receptionProcessId"', 'reception_process_id')
      .addSelect('MAX(pe.created_at)', 'created_at')
      .where('pe.is_active = :eventActive', { eventActive: true })
      .groupBy('pe."receptionProcessId"');

    const baseQuery = this.receptionProcessRepository.manager
      .createQueryBuilder()
      .from('reception_processes', 'rp')
      .innerJoin(
        `(${latestEventSubquery.getQuery()})`,
        'latest_event_ts',
        'latest_event_ts.reception_process_id = rp.id',
      )
      .innerJoin(
        'process_events',
        'latest_event',
        'latest_event."receptionProcessId" = latest_event_ts.reception_process_id AND latest_event.created_at = latest_event_ts.created_at AND latest_event.is_active = :eventActive',
      )
      .where('rp.is_active = :processActive', { processActive: true })
      .andWhere('rp.status = :inProgressStatus', {
        inProgressStatus: 'EN_PROGRESO',
      })
      .setParameters(latestEventSubquery.getParameters());

    if (normalizedStartDate) {
      baseQuery.andWhere('latest_event.created_at >= :startDate', {
        startDate: new Date(normalizedStartDate),
      });
    }

    if (normalizedEndDate) {
      baseQuery.andWhere('latest_event.created_at <= :endDate', {
        endDate: new Date(normalizedEndDate),
      });
    }

    const byRoleRows = await baseQuery
      .clone()
      .select('latest_event.role', 'role')
      .addSelect('COUNT(rp.id)', 'totalProcesses')
      .addSelect(
        'AVG(EXTRACT(EPOCH FROM (NOW() - latest_event.created_at)) / 60)',
        'avgMinutesSinceLastEvent',
      )
      .addSelect(
        'MAX(EXTRACT(EPOCH FROM (NOW() - latest_event.created_at)) / 60)',
        'maxMinutesSinceLastEvent',
      )
      .groupBy('latest_event.role')
      .orderBy(
        'AVG(EXTRACT(EPOCH FROM (NOW() - latest_event.created_at)) / 60)',
        'DESC',
      )
      .getRawMany<BottleneckByRoleRow>();

    const oldestProcess = await baseQuery
      .clone()
      .select('rp.id', 'receptionProcessId')
      .addSelect('rp.provider_name', 'providerName')
      .addSelect('rp.license_plates', 'licensePlates')
      .addSelect('latest_event.role', 'role')
      .addSelect('latest_event.status', 'status')
      .addSelect(
        'EXTRACT(EPOCH FROM (NOW() - latest_event.created_at)) / 60',
        'minutesSinceLastEvent',
      )
      .addSelect('latest_event.created_at', 'lastEventAt')
      .orderBy(
        'EXTRACT(EPOCH FROM (NOW() - latest_event.created_at)) / 60',
        'DESC',
      )
      .limit(1)
      .getRawOne<OldestProcessRow | null>();

    const summaryByRole = byRoleRows.map((row) => ({
      role: row.role,
      totalProcesses: Number(row.totalProcesses),
      avgMinutesSinceLastEvent: Number(row.avgMinutesSinceLastEvent),
      maxMinutesSinceLastEvent: Number(row.maxMinutesSinceLastEvent),
    }));

    const bottleneckRole = summaryByRole[0] ?? null;

    return {
      filters: {
        startDate: normalizedStartDate ?? null,
        endDate: normalizedEndDate ?? null,
      },
      inProgressProcesses: summaryByRole.reduce(
        (sum, item) => sum + item.totalProcesses,
        0,
      ),
      bottleneckRole,
      summaryByRole,
      oldestInProgressProcess: oldestProcess
        ? {
            receptionProcessId: Number(oldestProcess.receptionProcessId),
            providerName: oldestProcess.providerName,
            licensePlates: oldestProcess.licensePlates,
            role: oldestProcess.role,
            status: oldestProcess.status,
            minutesSinceLastEvent: Number(oldestProcess.minutesSinceLastEvent),
            lastEventAt: oldestProcess.lastEventAt,
          }
        : null,
      generatedAt: new Date().toISOString(),
    };
  }

  async getRoleWorkloadAndPerformance({
    startDate,
    endDate,
    role,
  }: GetRoleWorkloadAndPerformanceDto) {
    const normalizedStartDate =
      typeof startDate === 'string' ? startDate : undefined;
    const normalizedEndDate = typeof endDate === 'string' ? endDate : undefined;
    const normalizedRole = typeof role === 'string' ? role : undefined;

    const rolesToAnalyze: ProcessEventRole[] = normalizedRole
      ? [normalizedRole]
      : (Object.values(ProcessEventRole) as ProcessEventRole[]);

    const activeUsersQuery = this.userRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(user.id)', 'activeUsers')
      .where('user.isActive = :activeUserStatus', { activeUserStatus: true })
      .andWhere('user.role IN (:...rolesToAnalyze)', { rolesToAnalyze })
      .groupBy('user.role');

    const eventsByRoleQuery = this.processEventRepository
      .createQueryBuilder('event')
      .select('event.role', 'role')
      .addSelect('COUNT(event.id)', 'totalEvents')
      .where('event.isActive = :activeEventStatus', { activeEventStatus: true })
      .andWhere('event.role IN (:...rolesToAnalyze)', { rolesToAnalyze })
      .groupBy('event.role');

    const metricsByRoleQuery = this.notificationMetricRepository
      .createQueryBuilder('metric')
      .innerJoin('metric.createdBy', 'user')
      .select('user.role', 'role')
      .addSelect('COUNT(metric.id)', 'totalMetrics')
      .addSelect('AVG(metric.reactionTimeSec)', 'averageReactionTimeSec')
      .addSelect('MAX(metric.reactionTimeSec)', 'maxReactionTimeSec')
      .addSelect('AVG(metric.systemDelaySec)', 'averageSystemDelaySec')
      .addSelect('MAX(metric.systemDelaySec)', 'maxSystemDelaySec')
      .where('metric.isActive = :activeMetricStatus', {
        activeMetricStatus: true,
      })
      .andWhere('user.role IN (:...rolesToAnalyze)', { rolesToAnalyze })
      .groupBy('user.role');

    if (normalizedStartDate) {
      const start = new Date(normalizedStartDate);

      eventsByRoleQuery.andWhere('event.createdAt >= :startDate', {
        startDate: start,
      });

      metricsByRoleQuery.andWhere('metric.createdAt >= :startDate', {
        startDate: start,
      });
    }

    if (normalizedEndDate) {
      const end = new Date(normalizedEndDate);

      eventsByRoleQuery.andWhere('event.createdAt <= :endDate', {
        endDate: end,
      });

      metricsByRoleQuery.andWhere('metric.createdAt <= :endDate', {
        endDate: end,
      });
    }

    const [activeUsersRows, eventVolumeRows, metricPerformanceRows] =
      await Promise.all([
        activeUsersQuery.getRawMany<ActiveUsersByRoleRow>(),
        eventsByRoleQuery.getRawMany<EventVolumeByRoleRow>(),
        metricsByRoleQuery.getRawMany<MetricPerformanceByRoleRow>(),
      ]);

    const activeUsersMap = new Map(
      activeUsersRows.map((row) => [row.role, Number(row.activeUsers)]),
    );
    const eventVolumeMap = new Map(
      eventVolumeRows.map((row) => [row.role, Number(row.totalEvents)]),
    );
    const metricPerformanceMap = new Map(
      metricPerformanceRows.map((row) => [row.role, row]),
    );

    const saturationPriority = {
      CRITICA_SIN_USUARIOS: 4,
      ALTA: 3,
      MEDIA: 2,
      BAJA: 1,
      SIN_CARGA: 0,
    } as const;

    const data = rolesToAnalyze
      .map((currentRole) => {
        const activeUsers = activeUsersMap.get(currentRole) ?? 0;
        const totalEvents = eventVolumeMap.get(currentRole) ?? 0;
        const metricRow = metricPerformanceMap.get(currentRole);
        const totalMetrics = metricRow ? Number(metricRow.totalMetrics) : 0;

        const avgReactionTimeSec =
          metricRow?.averageReactionTimeSec === null ||
          metricRow?.averageReactionTimeSec === undefined
            ? null
            : Number(metricRow.averageReactionTimeSec);

        const maxReactionTimeSec =
          metricRow?.maxReactionTimeSec === null ||
          metricRow?.maxReactionTimeSec === undefined
            ? null
            : Number(metricRow.maxReactionTimeSec);

        const avgSystemDelaySec =
          metricRow?.averageSystemDelaySec === null ||
          metricRow?.averageSystemDelaySec === undefined
            ? null
            : Number(metricRow.averageSystemDelaySec);

        const maxSystemDelaySec =
          metricRow?.maxSystemDelaySec === null ||
          metricRow?.maxSystemDelaySec === undefined
            ? null
            : Number(metricRow.maxSystemDelaySec);

        const workloadVolume = totalEvents + totalMetrics;
        const workloadPerActiveUser =
          activeUsers > 0 ? workloadVolume / activeUsers : null;

        let saturationLevel: keyof typeof saturationPriority = 'SIN_CARGA';

        if (workloadVolume > 0 && activeUsers === 0) {
          saturationLevel = 'CRITICA_SIN_USUARIOS';
        } else if (
          (workloadPerActiveUser !== null && workloadPerActiveUser >= 120) ||
          (avgReactionTimeSec !== null && avgReactionTimeSec >= 120)
        ) {
          saturationLevel = 'ALTA';
        } else if (
          (workloadPerActiveUser !== null && workloadPerActiveUser >= 60) ||
          (avgReactionTimeSec !== null && avgReactionTimeSec >= 60)
        ) {
          saturationLevel = 'MEDIA';
        } else if (workloadVolume > 0) {
          saturationLevel = 'BAJA';
        }

        return {
          role: currentRole,
          activeUsers,
          totalEvents,
          totalMetrics,
          workloadVolume,
          workloadPerActiveUser:
            workloadPerActiveUser === null
              ? null
              : Number(workloadPerActiveUser.toFixed(2)),
          averageReactionTimeSec: avgReactionTimeSec,
          maxReactionTimeSec,
          averageSystemDelaySec: avgSystemDelaySec,
          maxSystemDelaySec,
          saturationLevel,
        };
      })
      .sort((left, right) => {
        const bySaturation =
          saturationPriority[right.saturationLevel] -
          saturationPriority[left.saturationLevel];

        if (bySaturation !== 0) {
          return bySaturation;
        }

        return right.workloadVolume - left.workloadVolume;
      });

    return {
      filters: {
        startDate: normalizedStartDate ?? null,
        endDate: normalizedEndDate ?? null,
        role: normalizedRole ?? null,
      },
      highestSaturationRole:
        data.find((item) => item.saturationLevel !== 'SIN_CARGA') ?? null,
      data,
      generatedAt: new Date().toISOString(),
    };
  }

  async getRejectionFunnel({
    startDate,
    endDate,
    role,
  }: GetRejectionFunnelDto) {
    const normalizedStartDate =
      typeof startDate === 'string' ? startDate : undefined;
    const normalizedEndDate = typeof endDate === 'string' ? endDate : undefined;
    const normalizedRole = typeof role === 'string' ? role : undefined;

    const latestEventSubquery = this.processEventRepository.manager
      .createQueryBuilder()
      .from('process_events', 'pe')
      .select('pe."receptionProcessId"', 'reception_process_id')
      .addSelect('MAX(pe.created_at)', 'created_at')
      .where('pe.is_active = :activeEventStatus', { activeEventStatus: true })
      .groupBy('pe."receptionProcessId"');

    const rejectedBaseQuery = this.receptionProcessRepository.manager
      .createQueryBuilder()
      .from('reception_processes', 'rp')
      .innerJoin(
        `(${latestEventSubquery.getQuery()})`,
        'latest_event_ts',
        'latest_event_ts.reception_process_id = rp.id',
      )
      .innerJoin(
        'process_events',
        'latest_event',
        'latest_event."receptionProcessId" = latest_event_ts.reception_process_id AND latest_event.created_at = latest_event_ts.created_at AND latest_event.is_active = :activeEventStatus',
      )
      .where('rp.is_active = :activeProcessStatus', {
        activeProcessStatus: true,
      })
      .andWhere('rp.status = :rejectedStatus', { rejectedStatus: 'RECHAZADO' })
      .setParameters(latestEventSubquery.getParameters());

    if (normalizedRole) {
      rejectedBaseQuery.andWhere('latest_event.role = :role', {
        role: normalizedRole,
      });
    }

    if (normalizedStartDate) {
      rejectedBaseQuery.andWhere('latest_event.created_at >= :startDate', {
        startDate: new Date(normalizedStartDate),
      });
    }

    if (normalizedEndDate) {
      rejectedBaseQuery.andWhere('latest_event.created_at <= :endDate', {
        endDate: new Date(normalizedEndDate),
      });
    }

    const rejectionRows = await rejectedBaseQuery
      .clone()
      .select('latest_event.role', 'role')
      .addSelect('latest_event.status', 'status')
      .addSelect('latest_event.event', 'event')
      .addSelect('COUNT(DISTINCT rp.id)', 'rejectedProcesses')
      .groupBy('latest_event.role')
      .addGroupBy('latest_event.status')
      .addGroupBy('latest_event.event')
      .orderBy('COUNT(DISTINCT rp.id)', 'DESC')
      .getRawMany<RejectionFunnelRow>();

    const rejectedSummary = await rejectedBaseQuery
      .clone()
      .select('COUNT(DISTINCT rp.id)', 'totalRejectedProcesses')
      .getRawOne<{ totalRejectedProcesses: string }>();

    const totalProcessesQuery = this.receptionProcessRepository
      .createQueryBuilder('rp')
      .select('COUNT(rp.id)', 'totalProcesses')
      .where('rp.isActive = :activeProcessStatus', {
        activeProcessStatus: true,
      });

    if (normalizedStartDate) {
      totalProcessesQuery.andWhere('rp.createdAt >= :startDate', {
        startDate: new Date(normalizedStartDate),
      });
    }

    if (normalizedEndDate) {
      totalProcessesQuery.andWhere('rp.createdAt <= :endDate', {
        endDate: new Date(normalizedEndDate),
      });
    }

    const totalProcessesSummary = await totalProcessesQuery.getRawOne<{
      totalProcesses: string;
    }>();

    const totalRejectedProcesses = Number(
      rejectedSummary?.totalRejectedProcesses ?? 0,
    );
    const totalProcesses = Number(totalProcessesSummary?.totalProcesses ?? 0);
    const rejectionRatePct =
      totalProcesses > 0
        ? Number(((totalRejectedProcesses / totalProcesses) * 100).toFixed(2))
        : null;

    const data = rejectionRows.map((row) => {
      const rejectedProcesses = Number(row.rejectedProcesses);
      const shareOfRejectedPct =
        totalRejectedProcesses > 0
          ? Number(
              ((rejectedProcesses / totalRejectedProcesses) * 100).toFixed(2),
            )
          : 0;

      return {
        role: row.role,
        stage: row.status,
        rejectionEvent: row.event,
        rejectedProcesses,
        shareOfRejectedPct,
      };
    });

    return {
      filters: {
        startDate: normalizedStartDate ?? null,
        endDate: normalizedEndDate ?? null,
        role: normalizedRole ?? null,
      },
      summary: {
        totalProcesses,
        totalRejectedProcesses,
        rejectionRatePct,
      },
      topRejectionPoint: data[0] ?? null,
      data,
      generatedAt: new Date().toISOString(),
    };
  }

  async getUserNotificationEffectiveness({
    startDate,
    endDate,
    role,
    userId,
  }: GetUserNotificationEffectivenessDto) {
    const normalizedStartDate =
      typeof startDate === 'string' ? startDate : undefined;
    const normalizedEndDate = typeof endDate === 'string' ? endDate : undefined;
    const normalizedRole = typeof role === 'string' ? role : undefined;
    const normalizedUserId =
      typeof userId === 'string' && userId.length > 0
        ? Number(userId)
        : undefined;

    const query = this.notificationMetricRepository
      .createQueryBuilder('metric')
      .innerJoin('metric.createdBy', 'user')
      .select('user.id', 'userId')
      .addSelect('user.name', 'name')
      .addSelect('user.email', 'email')
      .addSelect('user.role', 'role')
      .addSelect('COUNT(metric.id)', 'totalNotifications')
      .addSelect(
        "SUM(CASE WHEN metric.eventType = 'NOTIFICATION_SHOWN' THEN 1 ELSE 0 END)",
        'totalShown',
      )
      .addSelect(
        "SUM(CASE WHEN metric.eventType = 'ACTION_CLICKED_CONFIRM' THEN 1 ELSE 0 END)",
        'totalConfirmed',
      )
      .addSelect(
        "SUM(CASE WHEN metric.eventType = 'NOTIFICATION_CLOSED' THEN 1 ELSE 0 END)",
        'totalClosed',
      )
      .addSelect(
        "SUM(CASE WHEN metric.eventType = 'NOTIFICATION_CLICKED_NOT_ACTION' THEN 1 ELSE 0 END)",
        'totalClickedOutsideAction',
      )
      .addSelect('AVG(metric.reactionTimeSec)', 'avgReactionTimeSec')
      .addSelect('MAX(metric.reactionTimeSec)', 'maxReactionTimeSec')
      .where('metric.isActive = :activeMetricStatus', {
        activeMetricStatus: true,
      })
      .andWhere('user.isActive = :activeUserStatus', {
        activeUserStatus: true,
      })
      .groupBy('user.id')
      .addGroupBy('user.name')
      .addGroupBy('user.email')
      .addGroupBy('user.role');

    if (normalizedStartDate) {
      query.andWhere('metric.createdAt >= :startDate', {
        startDate: new Date(normalizedStartDate),
      });
    }

    if (normalizedEndDate) {
      query.andWhere('metric.createdAt <= :endDate', {
        endDate: new Date(normalizedEndDate),
      });
    }

    if (normalizedRole) {
      query.andWhere('user.role = :role', {
        role: normalizedRole,
      });
    }

    if (normalizedUserId !== undefined && !Number.isNaN(normalizedUserId)) {
      query.andWhere('user.id = :userId', {
        userId: normalizedUserId,
      });
    }

    const rows = await query
      .orderBy(
        "SUM(CASE WHEN metric.eventType = 'ACTION_CLICKED_CONFIRM' THEN 1 ELSE 0 END)",
        'DESC',
      )
      .addOrderBy('AVG(metric.reactionTimeSec)', 'ASC', 'NULLS LAST')
      .getRawMany<UserNotificationEffectivenessRow>();

    const data = rows.map((row) => {
      const totalNotifications = Number(row.totalNotifications);
      const totalShown = Number(row.totalShown);
      const totalConfirmed = Number(row.totalConfirmed);
      const totalClosed = Number(row.totalClosed);
      const totalClickedOutsideAction = Number(row.totalClickedOutsideAction);

      const confirmationRatePct =
        totalShown > 0
          ? Number(((totalConfirmed / totalShown) * 100).toFixed(2))
          : null;

      const noActionRatePct =
        totalShown > 0
          ? Number(
              (
                ((totalClosed + totalClickedOutsideAction) / totalShown) *
                100
              ).toFixed(2),
            )
          : null;

      return {
        userId: Number(row.userId),
        name: row.name,
        email: row.email,
        role: row.role,
        totalNotifications,
        totalShown,
        totalConfirmed,
        totalClosed,
        totalClickedOutsideAction,
        confirmationRatePct,
        noActionRatePct,
        avgReactionTimeSec:
          row.avgReactionTimeSec === null
            ? null
            : Number(row.avgReactionTimeSec),
        maxReactionTimeSec:
          row.maxReactionTimeSec === null
            ? null
            : Number(row.maxReactionTimeSec),
      };
    });

    const totalShown = data.reduce((sum, item) => sum + item.totalShown, 0);
    const totalConfirmed = data.reduce(
      (sum, item) => sum + item.totalConfirmed,
      0,
    );
    const overallConfirmationRatePct =
      totalShown > 0
        ? Number(((totalConfirmed / totalShown) * 100).toFixed(2))
        : null;

    const leastEffectiveUser =
      data
        .filter((item) => item.totalShown > 0)
        .sort((left, right) => {
          const leftRate = left.confirmationRatePct ?? Infinity;
          const rightRate = right.confirmationRatePct ?? Infinity;

          if (leftRate !== rightRate) {
            return leftRate - rightRate;
          }

          return right.totalShown - left.totalShown;
        })[0] ?? null;

    return {
      filters: {
        startDate: normalizedStartDate ?? null,
        endDate: normalizedEndDate ?? null,
        role: normalizedRole ?? null,
        userId: normalizedUserId ?? null,
      },
      summary: {
        usersWithMetrics: data.length,
        totalShown,
        totalConfirmed,
        overallConfirmationRatePct,
      },
      leastEffectiveUser,
      data,
      generatedAt: new Date().toISOString(),
    };
  }

  async getRolesCatalog() {
    const rows = await this.userRepository
      .createQueryBuilder('user')
      .select('DISTINCT user.role', 'role')
      .where('user.isActive = :isActive', { isActive: true })
      .andWhere('user.role IS NOT NULL')
      .orderBy('user.role', 'ASC')
      .getRawMany<DistinctRoleRow>();

    return {
      roles: rows.map((row) => row.role),
      total: rows.length,
    };
  }

  async getEventTypesCatalog() {
    const rows = await this.notificationMetricRepository
      .createQueryBuilder('metric')
      .select('DISTINCT metric.eventType', 'eventType')
      .where('metric.isActive = :isActive', { isActive: true })
      .andWhere('metric.eventType IS NOT NULL')
      .orderBy('metric.eventType', 'ASC')
      .getRawMany<DistinctEventTypeRow>();

    return {
      eventTypes: rows.map((row) => row.eventType),
      total: rows.length,
    };
  }
}
