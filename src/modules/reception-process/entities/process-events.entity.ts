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

export enum ProcessEventStatus {
  INGRESO_AUTORIZADO = 'INGRESO_AUTORIZADO',
  CALIDAD_APROBADO = 'CALIDAD_APROBADO',
  CALIDAD_RECHAZADO = 'CALIDAD_RECHAZADO',
  DESCARGA_FINALIZADA = 'DESCARGA_FINALIZADA',
  PESO_CAPTURADO = 'PESO_CAPTURADO',
  LIBERADO_SAP = 'LIBERADO_SAP',
}

export enum ProcessEventRole {
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
  type: ProcessEventStatus;

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
