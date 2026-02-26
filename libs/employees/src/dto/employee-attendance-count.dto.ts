import { ApiProperty } from '@nestjs/swagger';

export class EmployeeAttendanceCountDto {
  @ApiProperty({ example: 'uuid-here' })
  id!: string;

  @ApiProperty({ example: 'John Doe' })
  names!: string;

  @ApiProperty({ example: 12 })
  attendancesCount!: number;
}
