import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ReceptionProcess } from './reception-process.entity';
import { User } from 'src/modules/users';

export enum NotificationEventType {
  PUSH_RECEIVED = 'PUSH_RECEIVED',
  NOTIFICATION_SHOWN = 'NOTIFICATION_SHOWN',
  NOTIFICATION_CLICKED = 'NOTIFICATION_CLICKED',
  ACTION_CLICKED = 'ACTION_CLICKED',
  NOTIFICATION_CLOSED = 'NOTIFICATION_CLOSED',
  EXPIRED = 'EXPIRED',
}

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
