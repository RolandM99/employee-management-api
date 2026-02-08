import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { DailyAttendanceReportRow } from '../interfaces/daily-attendance-report-row.interface';

@Injectable()
export class AttendanceExcelReportBuilder {
  async build(date: string, rows: DailyAttendanceReportRow[]): Promise<Buffer> {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Daily Attendance');

    sheet.columns = [
      { header: 'Employee', key: 'names' },
      { header: 'Identifier', key: 'employeeIdentifier' },
      { header: 'Check In', key: 'checkInAt' },
      { header: 'Check Out', key: 'checkOutAt' },
      { header: 'Status', key: 'status' },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' },
    };

    for (const row of rows) {
      sheet.addRow({
        names: row.names,
        employeeIdentifier: row.employeeIdentifier,
        checkInAt: this.formatDateTime(row.checkInAt),
        checkOutAt: this.formatDateTime(row.checkOutAt),
        status: row.status,
      });
    }

    sheet.insertRow(1, [`Daily Attendance Report - ${date}`]);
    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').font = { bold: true, size: 14 };

    this.autoSizeColumns(sheet);

    const output = await workbook.xlsx.writeBuffer();
    return Buffer.from(output as ArrayBuffer);
  }

  private autoSizeColumns(worksheet: Workbook['worksheets'][number], minWidth = 12): void {
    worksheet.columns.forEach((column) => {
      let maxLength = 0;

      if (!column.eachCell) {
        return;
      }

      column.eachCell({ includeEmpty: true }, (cell) => {
        const value = cell.value ? String(cell.value) : '';
        maxLength = Math.max(maxLength, value.length);
      });

      column.width = Math.max(minWidth, maxLength + 2);
    });
  }

  private formatDateTime(value: Date | null): string {
    if (!value) {
      return '-';
    }

    return value.toISOString().replace('T', ' ').slice(0, 19);
  }
}
