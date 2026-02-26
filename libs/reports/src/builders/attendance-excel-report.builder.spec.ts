import { AttendanceExcelReportBuilder } from './attendance-excel-report.builder';
import { DailyAttendanceReportRow } from '../interfaces/daily-attendance-report-row.interface';

describe('AttendanceExcelReportBuilder', () => {
  it('builds a non-empty xlsx buffer with expected rows', async () => {
    const builder = new AttendanceExcelReportBuilder();

    const rows: DailyAttendanceReportRow[] = [
      {
        names: 'John Doe',
        employeeIdentifier: 'EMP-001',
        checkInAt: new Date('2026-02-07T09:00:00.000Z'),
        checkOutAt: new Date('2026-02-07T17:00:00.000Z'),
        status: 'Left',
      },
      {
        names: 'Jane Doe',
        employeeIdentifier: 'EMP-002',
        checkInAt: null,
        checkOutAt: null,
        status: 'Absent',
      },
    ];

    const buffer = await builder.build('2026-02-07', rows);

    expect(buffer.length).toBeGreaterThan(100);

    // XLSX is a zip container, so it should start with PK.
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
  });
});
