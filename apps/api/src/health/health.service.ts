import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse, ReadinessResponse, UnavailableResponse } from '@nexo/contracts';

import { DatabaseService } from '../database/database.service.js';

const UNAVAILABLE: UnavailableResponse = {
  status: 'unavailable',
  service: 'nexo-api',
  database: 'unavailable',
};

@Injectable()
export class HealthService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  liveness(): HealthResponse {
    return { status: 'ok', service: 'nexo-api' };
  }

  async readiness(): Promise<ReadinessResponse> {
    if (!(await this.database.isReady())) {
      throw new ServiceUnavailableException(UNAVAILABLE);
    }

    return { status: 'ok', service: 'nexo-api', database: 'ready' };
  }
}
