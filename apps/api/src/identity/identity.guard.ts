import { Inject, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { UserView } from '@nexo/contracts';
import { IdentityService } from './identity.service.js';

export interface AuthRequest { headers: { cookie?: string }; user: UserView; }
export function sessionToken(cookie: string | undefined): string {
  return cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('nexo_session='))?.slice('nexo_session='.length) ?? '';
}
@Injectable()
export class IdentityGuard implements CanActivate {
  constructor(@Inject(IdentityService) private readonly identity: IdentityService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = await this.identity.resolve(sessionToken(request.headers.cookie));
    if (!user) throw new UnauthorizedException();
    request.user = user;
    return true;
  }
}
