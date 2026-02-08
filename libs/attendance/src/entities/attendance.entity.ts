import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Employee } from '@app/employees/entities/employee.entity';

@Entity('attendances')
@Unique('UQ_attendance_employee_date', ['employeeId', 'date'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  employeeId!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'datetime' })
  checkInAt!: Date;

  @Column({ type: 'datetime', nullable: true, default: null })
  checkOutAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Employee, (employee) => employee.attendances, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'employeeId' })
  employee!: Employee;
}
