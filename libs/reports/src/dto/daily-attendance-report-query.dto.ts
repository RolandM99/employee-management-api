import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches } from 'class-validator';

export class DailyAttendanceReportQueryDto {
  @ApiProperty({
    description: 'Report date in YYYY-MM-DD format',
    example: '2026-02-07',
  })
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date!: string;
}
