import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ReceptionProcess } from './reception-process.entity';
import { User } from 'src/modules/users/entities/user.entity';

export enum ProcessEventStatus {
  PROVIDER_ARRIVED = 'PROVIDER_ARRIVED',
  ENTRY_AUTHORIZED = 'ENTRY_AUTHORIZED', // Hay forma de que logistica negara el acceso? => ENTRY_DENIED
  QUALITY_APPROVED = 'QUALITY_APPROVED',
  QUALITY_REJECTED = 'QUALITY_REJECTED',
  UNLOAD_STARTED = 'UNLOAD_STARTED', // Este es un estatus adicional, para que produccion notifique cuando inicia la descarga
  UNLOAD_COMPLETED = 'UNLOAD_COMPLETED', // y cuando la termina (opcional)
  WEIGHT_RECORDED = 'WEIGHT_RECORDED',
  SAP_RELEASE_COMPLETED = 'SAP_RELEASE_COMPLETED',
  EXIT_AUTHORIZED = 'EXIT_AUTHORIZED',
  PROCESS_COMPLETED = 'PROCESS_COMPLETED', // Este y el de arriba es el mismo, solo hay que ver cual sera la mejor opcion de descripcion
}

export enum ProcessEventRole {
  VIGILANCIA = 'VIGILANCIA',
  LOGISTICA = 'LOGISTICA',
  CALIDAD = 'CALIDAD',
  PRODUCCION = 'PRODUCCION',
}

@Entity({
  name: 'process_events',
})
export class ProcessEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: ProcessEventStatus,
  })
  status: ProcessEventStatus;

  @Column({
    type: 'enum',
    enum: ProcessEventRole,
  })
  role: ProcessEventRole;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @ManyToOne(() => User, (user) => user.createdByProcessEvents)
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
