import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '@app/employees';
import { Attendance } from '@app/attendance';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AttendancePdfReportBuilder } from './builders/attendance-pdf-report.builder';
import { AttendanceExcelReportBuilder } from './builders/attendance-excel-report.builder';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, Attendance])],
  controllers: [ReportsController],
  providers: [ReportsService, AttendancePdfReportBuilder, AttendanceExcelReportBuilder],
  exports: [ReportsService],
})
export class ReportsModule {}
