import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { LoginInputSchema } from '@nexo/contracts';
import { IdentityGuard, sessionToken, type AuthRequest } from './identity.guard.js';
import { IdentityService } from './identity.service.js';

export const SECURE_COOKIE = Symbol('SECURE_COOKIE');
interface CookieResponse {
  cookie(name: string, value: string, options: { httpOnly: boolean; sameSite: 'lax'; path: string; maxAge: number; secure: boolean }): void;
  clearCookie(name: string, options: { httpOnly: boolean; sameSite: 'lax'; path: string; secure: boolean }): void;
}
@Controller('session')
export class IdentityController {
  constructor(@Inject(IdentityService) private readonly identity: IdentityService, @Inject(SECURE_COOKIE) private readonly secure: boolean) {}
  @Post()
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: CookieResponse) {
    const parsed = LoginInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException();
    const result = await this.identity.login(parsed.data);
    response.cookie('nexo_session', result.token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 86400000, secure: this.secure });
    return result.user;
  }
  @Get() @UseGuards(IdentityGuard)
  current(@Req() request: AuthRequest) { return request.user; }
  @Delete() @HttpCode(204)
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: CookieResponse) {
    await this.identity.logout(sessionToken(request.headers.cookie));
    response.clearCookie('nexo_session', { httpOnly: true, sameSite: 'lax', path: '/', secure: this.secure });
  }
}
