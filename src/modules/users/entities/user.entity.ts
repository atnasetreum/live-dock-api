import * as argon2 from 'argon2';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BeforeInsert,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

import { Subscription } from 'src/modules/push-notifications/entities/subscription.entity';
import {
  ProcessEvent,
  NotificationMetric,
  ReceptionProcess,
  PriorityAlert,
} from 'src/modules/reception-process/entities';

export enum UserRole {
  VIGILANCIA = 'VIGILANCIA',
  LOGISTICA = 'LOGISTICA',
  CALIDAD = 'CALIDAD',
  PRODUCCION = 'PRODUCCION',
  SISTEMA = 'SISTEMA',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    length: 100,
  })
  name: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ select: false, length: 255 })
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role: UserRole;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;

  @OneToMany(() => Subscription, (subscription) => subscription.user)
  subscriptions: Subscription[];

  @OneToMany(() => ProcessEvent, (processEvent) => processEvent.createdBy)
  createdByProcessEvents: ProcessEvent[];

  @OneToMany(
    () => NotificationMetric,
    (notificationMetric) => notificationMetric.createdBy,
  )
  createdByNotificationMetrics: NotificationMetric[];

  @OneToMany(
    () => ReceptionProcess,
    (receptionProcess) => receptionProcess.createdBy,
  )
  createdByReceptionProcesses: ReceptionProcess[];

  @OneToMany(() => PriorityAlert, (priorityAlert) => priorityAlert.createdBy)
  priorityAlerts: PriorityAlert[];

  @BeforeInsert()
  async hashPassword() {
    this.password = await argon2.hash(this.password);
  }
}
