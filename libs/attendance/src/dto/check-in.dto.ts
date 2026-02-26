import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CheckInDto {
  @ApiProperty({ description: 'Employee UUID' })
  @IsUUID()
  @IsNotEmpty()
  employeeId!: string;

  @ApiPropertyOptional({
    description: 'Optional ISO datetime for check-in. Defaults to server current time.',
    example: '2026-02-07T09:00:00',
  })
  @IsDateString()
  @IsOptional()
  occurredAt?: string;
}
