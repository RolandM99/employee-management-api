import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttendanceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty({ example: '2026-02-07' })
  date!: string;

  @ApiProperty({ example: '2026-02-07T09:00:00.000Z' })
  checkInAt!: Date;

  @ApiPropertyOptional({ example: '2026-02-07T17:00:00.000Z', nullable: true })
  checkOutAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
