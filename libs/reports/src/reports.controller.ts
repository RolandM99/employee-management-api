import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { DailyAttendanceReportQueryDto } from './dto/daily-attendance-report-query.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('attendance/daily.pdf')
  @ApiOperation({ summary: 'Download daily attendance report as PDF' })
  @ApiQuery({ name: 'date', type: String, description: 'Date in YYYY-MM-DD format' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF report stream' })
  @ApiResponse({ status: 400, description: 'Invalid date format' })
  async downloadDailyAttendancePdf(
    @Query() query: DailyAttendanceReportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const fileName = `attendance-daily-${query.date}.pdf`;
    const buffer = await this.reportsService.generateDailyAttendancePdf(query.date);

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    return new StreamableFile(buffer);
  }

  @Get('attendance/daily.xlsx')
  @ApiOperation({ summary: 'Download daily attendance report as Excel' })
  @ApiQuery({ name: 'date', type: String, description: 'Date in YYYY-MM-DD format' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiResponse({ status: 200, description: 'Excel report stream' })
  @ApiResponse({ status: 400, description: 'Invalid date format' })
  async downloadDailyAttendanceExcel(
    @Query() query: DailyAttendanceReportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const fileName = `attendance-daily-${query.date}.xlsx`;
    const buffer = await this.reportsService.generateDailyAttendanceExcel(query.date);

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    return new StreamableFile(buffer);
  }
}
