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
import { NotificationMetric } from 'src/modules/reception-process/entities';
import { GetDelaysByRoleDto, McpLoginDto } from './dto';

type DelayByRoleRow = {
  role: string;
  totalMetrics: string;
  averageReactionTimeSec: string | null;
  averageSystemDelaySec: string | null;
  maxReactionTimeSec: string | null;
  maxSystemDelaySec: string | null;
};

@Injectable()
export class McpService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(NotificationMetric)
    private readonly notificationMetricRepository: Repository<NotificationMetric>,
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
}
