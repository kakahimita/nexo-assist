import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import type { ApiEnvironment } from './config/environment.js';

export async function createApp(environment: ApiEnvironment): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.register(environment));

  app.setGlobalPrefix('api');
  app.enableCors({ origin: [environment.webOrigin] });
  app.enableShutdownHooks();
  await app.init();

  return app;
}
