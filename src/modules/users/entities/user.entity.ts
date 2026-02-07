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

import { Subscription } from 'src/modules/push-notifications';
import {
  NotificationMetric,
  ProcessEvent,
  ReceptionProcess,
} from 'src/modules/reception-process';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

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

  @BeforeInsert()
  async hashPassword() {
    this.password = await argon2.hash(this.password);
  }
}
