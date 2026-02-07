import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '@app/employees';
import { Attendance } from '@app/attendance';
import { AttendancePdfReportBuilder } from './builders/attendance-pdf-report.builder';
import { AttendanceExcelReportBuilder } from './builders/attendance-excel-report.builder';
import { DailyAttendanceReportRow } from './interfaces/daily-attendance-report-row.interface';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    private readonly attendancePdfReportBuilder: AttendancePdfReportBuilder,
    private readonly attendanceExcelReportBuilder: AttendanceExcelReportBuilder,
  ) {}

  async generateDailyAttendancePdf(date: string): Promise<Buffer> {
    const rows = await this.getDailyAttendanceRows(date);
    return this.attendancePdfReportBuilder.build(date, rows);
  }

  async generateDailyAttendanceExcel(date: string): Promise<Buffer> {
    const rows = await this.getDailyAttendanceRows(date);
    return this.attendanceExcelReportBuilder.build(date, rows);
  }

  async getDailyAttendanceRows(date: string): Promise<DailyAttendanceReportRow[]> {
    const [employees, attendances] = await Promise.all([
      this.employeesRepository.find({
        order: {
          employeeIdentifier: 'ASC',
        },
      }),
      this.attendanceRepository.find({
        where: { date },
      }),
    ]);

    const attendanceByEmployeeId = new Map(
      attendances.map((attendance) => [attendance.employeeId, attendance]),
    );

    return employees.map((employee) => {
      const attendance = attendanceByEmployeeId.get(employee.id) ?? null;

      return {
        names: employee.names,
        employeeIdentifier: employee.employeeIdentifier,
        checkInAt: attendance?.checkInAt ?? null,
        checkOutAt: attendance?.checkOutAt ?? null,
        status: this.computeStatus(attendance),
      };
    });
  }

  private computeStatus(attendance: Attendance | null): DailyAttendanceReportRow['status'] {
    if (!attendance || !attendance.checkInAt) {
      return 'Absent';
    }

    if (attendance.checkOutAt) {
      return 'Left';
    }

    return 'Present';
  }
}
