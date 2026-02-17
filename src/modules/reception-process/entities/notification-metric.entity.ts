import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ReceptionProcess } from './reception-process.entity';
import { User } from 'src/modules/users/entities/user.entity';

export enum NotificationEventType {
  NOTIFICATION_SHOWN = 'NOTIFICATION_SHOWN',
  ACTION_CLICKED_CONFIRM = 'ACTION_CLICKED_CONFIRM',
  NOTIFICATION_CLICKED_NOT_ACTION = 'NOTIFICATION_CLICKED_NOT_ACTION',
  NOTIFICATION_CLOSED = 'NOTIFICATION_CLOSED',
  EXPIRED = 'EXPIRED',
}

// Índices compuestos para consultas comunes
@Index(['eventType', 'createdAt']) // Ya existente - para consultas por tipo y fecha
@Index(['eventType', 'reactionTimeSec']) // Nuevo - para promedios por evento
@Index(['createdAt']) // Nuevo - para filtros por fecha
@Index(['reactionTimeSec']) // Nuevo - para filtros y agregaciones de tiempo
@Index(['createdBy', 'eventType']) // Nuevo - para consultas por usuario y evento
@Entity({
  name: 'notification_metrics',
})
export class NotificationMetric {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: NotificationEventType,
    name: 'event_type',
  })
  eventType: NotificationEventType;

  @Column({ name: 'visible_at', nullable: true })
  visibleAt: Date;

  @Column({ name: 'action_at', nullable: true })
  actionAt: Date;

  @Column({ name: 'reaction_time_sec', nullable: true })
  reactionTimeSec: number;

  @Column({ name: 'system_delay_sec', nullable: true })
  systemDelaySec: number;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @ManyToOne(() => User, (user) => user.createdByNotificationMetrics)
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;

  @ManyToOne(
    () => ReceptionProcess,
    (receptionProcess) => receptionProcess.events,
  )
  receptionProcess: ReceptionProcess;
}
