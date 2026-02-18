import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from 'src/modules/users/entities/user.entity';
import { ReceptionProcess } from './reception-process.entity';

export enum PriorityAlertSeverity {
  ALTA = 'Alta',
  MEDIA = 'Media',
  BAJA = 'Baja',
}

export enum PriorityAlertRole {
  VIGILANCIA = 'VIGILANCIA',
  LOGISTICA = 'LOGISTICA',
  CALIDAD = 'CALIDAD',
  PRODUCCION = 'PRODUCCION',
  SISTEMA = 'SISTEMA',
  ADMIN = 'ADMIN',
}

@Index(['severity', 'isActive', 'createdAt']) // 1. ⭐ Dashboard crítico
@Index(['receptionProcess', 'severity']) // 2. Alertas por proceso
@Index(['isActive', 'createdAt']) // 3. Feed activas
@Index(['createdBy', 'severity']) // 4. Por usuario
@Index(['createdAt']) // 5. Temporal
@Index(['role', 'isActive']) // 6. Por rol
@Entity({
  name: 'priority_alerts',
})
export class PriorityAlert {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    length: 100,
  })
  title: string;

  @Column({
    length: 255,
  })
  detail: string;

  @Column({
    type: 'enum',
    enum: PriorityAlertSeverity,
  })
  severity: PriorityAlertSeverity;

  @Column({
    type: 'enum',
    enum: PriorityAlertRole,
  })
  role: PriorityAlertRole;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @ManyToOne(() => User, (user) => user.priorityAlerts)
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;

  @ManyToOne(
    () => ReceptionProcess,
    (receptionProcess) => receptionProcess.priorityAlerts,
  )
  receptionProcess: ReceptionProcess;
}
