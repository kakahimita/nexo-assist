import { Controller, Get, Inject } from '@nestjs/common';
import type { HealthResponse, ReadinessResponse } from '@nexo/contracts';

import { HealthService } from './health.service.js';

@Controller()
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get('health')
  liveness(): HealthResponse {
    return this.health.liveness();
  }

  @Get('ready')
  readiness(): Promise<ReadinessResponse> {
    return this.health.readiness();
  }
}
