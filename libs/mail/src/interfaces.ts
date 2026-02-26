export interface SendResetPasswordEmailPayload {
  email: string;
  resetUrl: string;
}

export interface SendAttendanceNotificationPayload {
  email: string;
  employeeName: string;
  attendanceDate: string;
  status: 'check-in' | 'check-out';
  occurredAt: string;
}
