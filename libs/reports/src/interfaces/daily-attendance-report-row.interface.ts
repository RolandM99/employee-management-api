export interface DailyAttendanceReportRow {
  names: string;
  employeeIdentifier: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  status: 'Absent' | 'Present' | 'Left';
}
