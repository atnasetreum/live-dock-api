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

export enum Event {
  REGISTRA_INGRESO = 'REGISTRA_INGRESO',
  CAMBIO_ESTADO = 'CAMBIO_ESTADO',
  CONFIRMA_NOTIFICACION = 'CONFIRMA_NOTIFICACION',
  /* LOGISTICA_AUTORIZA = 'LOGISTICA_AUTORIZA',
  LOGISTICA_RECHAZA = 'LOGISTICA_RECHAZA',
  CALIDAD_APRUEBA = 'CALIDAD_APRUEBA',
  CALIDAD_RECHAZA = 'CALIDAD_RECHAZA',
  PRODUCCION_FINALIZA_DESCARGA = 'PRODUCCION_FINALIZA_DESCARGA',
  LOGISTICA_REGISTRA_PESO = 'LOGISTICA_REGISTRA_PESO',
  CALIDAD_LIBERA_SAP = 'CALIDAD_LIBERA_SAP',
  VIGILANCIA_CONFIRMA_SALIDA = 'VIGILANCIA_CONFIRMA_SALIDA', */
}

export enum ProcessState {
  REGISTRADA = 'REGISTRADA',
  PENDIENTE_CONFIRMACION = 'PENDIENTE_CONFIRMACION',
  PENDIENTE_AUTORIZACION = 'PENDIENTE_AUTORIZACION',
  /* 
  PENDIENTE_REVISION_CALIDAD = 'PENDIENTE_REVISION_CALIDAD',
  APROBADA_CALIDAD = 'APROBADA_CALIDAD',
  EN_DESCARGA = 'EN_DESCARGA',
  DESCARGA_COMPLETADA = 'DESCARGA_COMPLETADA',
  PENDIENTE_REGISTRO_PESO = 'PENDIENTE_REGISTRO_PESO',
  PESO_REGISTRADO = 'PESO_REGISTRADO',
  PENDIENTE_LIBERACION_SAP = 'PENDIENTE_LIBERACION_SAP',
  LIBERADA_SAP = 'LIBERADA_SAP',
  PENDIENTE_SALIDA = 'PENDIENTE_SALIDA',
  RECHAZADA = 'RECHAZADA',
  CONCLUIDA = 'CONCLUIDA', */
}

export enum ProcessEventRole {
  VIGILANCIA = 'VIGILANCIA',
  LOGISTICA = 'LOGISTICA',
  CALIDAD = 'CALIDAD',
  PRODUCCION = 'PRODUCCION',
  SISTEMA = 'SISTEMA',
}

@Entity({
  name: 'process_events',
})
export class ProcessEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: ProcessState,
  })
  status: ProcessState;

  @Column({
    type: 'enum',
    enum: Event,
  })
  event: Event;

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
