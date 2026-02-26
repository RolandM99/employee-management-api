import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ListAttendanceQueryDto {
  @ApiPropertyOptional({ description: 'Filter by employee UUID' })
  @IsUUID()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional({
    description: 'Filter records whose attendance date is greater than or equal to this date',
    example: '2026-02-01',
  })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter records whose attendance date is less than or equal to this date',
    example: '2026-02-28',
  })
  @IsDateString()
  @IsOptional()
  dateTo?: string;
}
