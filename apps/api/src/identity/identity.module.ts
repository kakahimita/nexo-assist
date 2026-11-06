import { Module, type DynamicModule } from '@nestjs/common';
import { IdentityController, SECURE_COOKIE } from './identity.controller.js';
import { IdentityGuard } from './identity.guard.js';
import { IdentityService } from './identity.service.js';
import { SessionModelKeyStore } from './session-model-key.store.js';

@Module({})
export class IdentityModule {
  static register(secure: boolean): DynamicModule {
    return {
      module: IdentityModule,
      global: true,
      controllers: [IdentityController],
      providers: [
        IdentityService,
        IdentityGuard,
        SessionModelKeyStore,
        { provide: SECURE_COOKIE, useValue: secure },
      ],
      exports: [IdentityGuard, IdentityService, SessionModelKeyStore],
    };
  }
}
