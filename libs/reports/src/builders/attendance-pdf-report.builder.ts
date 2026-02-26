import { Injectable } from '@nestjs/common';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DailyAttendanceReportRow } from '../interfaces/daily-attendance-report-row.interface';

@Injectable()
export class AttendancePdfReportBuilder {
  build(date: string, rows: DailyAttendanceReportRow[]): Buffer {
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(14);
    doc.text(`Daily Attendance Report - ${date}`, 14, 15);

    autoTable(doc, {
      startY: 22,
      head: [['Employee', 'Identifier', 'Check In', 'Check Out', 'Status']],
      body: rows.map((row) => [
        row.names,
        row.employeeIdentifier,
        this.formatDateTime(row.checkInAt),
        this.formatDateTime(row.checkOutAt),
        row.status,
      ]),
      styles: {
        fontSize: 10,
      },
      headStyles: {
        fillColor: [33, 37, 41],
      },
    });

    const output = doc.output('arraybuffer');
    return Buffer.from(output);
  }

  private formatDateTime(value: Date | null): string {
    if (!value) {
      return '-';
    }

    return value.toISOString().replace('T', ' ').slice(0, 19);
  }
}
