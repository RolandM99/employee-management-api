import { ApiProperty } from '@nestjs/swagger';

export class EmployeeResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'John Doe' })
  names!: string;

  @ApiProperty({ example: 'john.doe@company.com' })
  email!: string;

  @ApiProperty({ example: 'EMP-001' })
  employeeIdentifier!: string;

  @ApiProperty({ example: '+250788123456' })
  phoneNumber!: string;

  @ApiProperty({ example: '2026-02-07T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-02-07T09:05:00.000Z' })
  updatedAt!: Date;
}
