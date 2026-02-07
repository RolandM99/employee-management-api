import { Controller, Get, ServiceUnavailableException, VERSION_NEUTRAL } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '@app/common';
import { HealthCheckResponseDto } from './dto/health-check-response.dto';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Check API, MySQL, and Redis connectivity' })
  @ApiOkResponse({ type: HealthCheckResponseDto })
  @ApiServiceUnavailableResponse({
    description: 'One or more dependencies are unavailable',
    type: HealthCheckResponseDto,
  })
  async check(): Promise<HealthCheckResponseDto> {
    const result = await this.healthService.check();

    if (result.status === 'error') {
      throw new ServiceUnavailableException({
        message: 'Dependency health check failed',
        checks: result.checks,
      });
    }

    return result;
  }
}
