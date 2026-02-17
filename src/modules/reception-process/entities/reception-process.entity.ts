import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { NotificationMetric } from './notification-metric.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { ProcessEvent } from './process-events.entity';
import { PriorityAlert } from './priority-alert.entity';

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

@Index(['status', 'createdAt']) // 1. Filtros por estado y fecha
@Index(['typeOfMaterial', 'createdAt']) // 2. Distribución de materiales
@Index(['createdBy', 'status']) // 3. Procesos por usuario
@Index(['isActive', 'status']) // 4. Procesos activos
@Index(['createdAt']) // 5. Ordenamiento temporal
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

  @Column({ name: 'processing_time_minutes', nullable: true })
  processingTimeMinutes: number;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @ManyToOne(() => User, (user) => user.createdByReceptionProcesses)
  createdBy: User;

  @CreateDateColumn({
    name: 'created_at',
  })
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

  @OneToMany(
    () => PriorityAlert,
    (priorityAlert) => priorityAlert.receptionProcess,
  )
  priorityAlerts: PriorityAlert[];
}
