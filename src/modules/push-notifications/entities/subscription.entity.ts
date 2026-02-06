import {
  PrimaryGeneratedColumn,
  Column,
  Entity,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';

import { User } from 'src/modules/users';

@Entity({ name: 'subscriptions' })
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  subscription: string;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.subscriptions)
  user: User;
}
