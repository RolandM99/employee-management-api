import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '@app/common';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'enum', enum: Role, nullable: true, default: null })
  role!: Role | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  refreshTokenHash!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  resetTokenHash!: string | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  resetTokenExpiresAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
