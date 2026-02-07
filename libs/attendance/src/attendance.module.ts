import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '@app/mail';
import { Employee } from '@app/employees';
import { Attendance } from './entities/attendance.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Attendance, Employee]), MailModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [TypeOrmModule, AttendanceService],
})
export class AttendanceModule {}
