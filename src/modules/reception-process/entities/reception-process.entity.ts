import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { NotificationMetric } from './notification-metric.entity';
import { ProcessEvent } from './process-events.entity';
import { User } from 'src/modules/users';

export enum ReceptionProcessStatus {
  EN_PROGRESO = 'EN_PROGRESO',
  RECHAZADO = 'RECHAZADO',
  FINALIZADO = 'FINALIZADO',
}

export enum ReceptionProcessTypeOfMaterial {
  ALCOHOL = 'ALCOHOL',
  AGUA = 'AGUA',
  LESS = 'LESS',
  COLGATE = 'COLGATE',
}

@Entity({
  name: 'reception_processes',
})
export class ReceptionProcess {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: ReceptionProcessStatus,
    default: ReceptionProcessStatus.EN_PROGRESO,
  })
  status: ReceptionProcessStatus;

  @Column({
    type: 'enum',
    enum: ReceptionProcessTypeOfMaterial,
    name: 'type_of_material',
  })
  typeOfMaterial: ReceptionProcessTypeOfMaterial;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @ManyToOne(() => User, (user) => user.createdByReceptionProcesses)
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;

  @OneToMany(
    () => ProcessEvent,
    (processEvent) => processEvent.receptionProcess,
  )
  events: ProcessEvent[];

  @OneToMany(
    () => NotificationMetric,
    (notificationMetric) => notificationMetric.receptionProcess,
  )
  metrics: NotificationMetric[];
}
