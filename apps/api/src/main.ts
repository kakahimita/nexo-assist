import 'reflect-metadata';

import { createApp } from './app.js';
import { loadApiEnvironment } from './config/environment.js';

async function bootstrap(): Promise<void> {
  const environment = loadApiEnvironment();
  const app = await createApp(environment);

  await app.listen(environment.port, environment.host);
}

bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'API startup failed.');
  process.exitCode = 1;
});
