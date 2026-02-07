import { ApiProperty } from '@nestjs/swagger';
import { EmployeeResponseDto } from './employee-response.dto';

class EmployeesPaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;
}

export class ListEmployeesResponseDto {
  @ApiProperty({ type: [EmployeeResponseDto] })
  data!: EmployeeResponseDto[];

  @ApiProperty({ type: EmployeesPaginationMetaDto })
  meta!: EmployeesPaginationMetaDto;
}
