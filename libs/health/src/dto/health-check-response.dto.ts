import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class DependencyHealthDto {
  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  status!: 'up' | 'down';

  @ApiProperty({ example: 12 })
  latencyMs!: number;

  @ApiPropertyOptional({ example: 'connect ECONNREFUSED 127.0.0.1:6379' })
  message?: string;
}

class HealthChecksDto {
  @ApiProperty({ type: DependencyHealthDto })
  database!: DependencyHealthDto;

  @ApiProperty({ type: DependencyHealthDto })
  redis!: DependencyHealthDto;
}

export class HealthCheckResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  status!: 'ok' | 'error';

  @ApiProperty({ type: HealthChecksDto })
  checks!: HealthChecksDto;
}
