import { AttendancePdfReportBuilder } from './attendance-pdf-report.builder';
import { DailyAttendanceReportRow } from '../interfaces/daily-attendance-report-row.interface';

describe('AttendancePdfReportBuilder', () => {
  it('builds a non-empty PDF buffer with valid PDF signature', () => {
    const builder = new AttendancePdfReportBuilder();

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

    const buffer = builder.build('2026-02-07', rows);

    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
