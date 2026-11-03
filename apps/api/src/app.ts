import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import type { ApiEnvironment } from './config/environment.js';
import type { ConsultationEngine } from './agent/consultation/types.js';

export async function createApp(environment: ApiEnvironment, overrides?: { consultationEngine?: ConsultationEngine }): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.register(environment, overrides));

  app.setGlobalPrefix('api');
  app.use((request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const origin = request.headers.origin;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method ?? '') && origin && origin !== environment.webOrigin) {
      response.statusCode = 403;
      response.end();
      return;
    }
    next();
  });
  app.enableCors({ origin: [environment.webOrigin] });
  app.enableShutdownHooks();
  await app.init();

  return app;
}
