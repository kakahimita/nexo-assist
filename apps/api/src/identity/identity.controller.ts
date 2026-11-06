import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { DemoModelKeyInputSchema, LoginInputSchema } from '@nexo/contracts';
import { IdentityGuard, sessionToken, type AuthRequest } from './identity.guard.js';
import { IdentityService } from './identity.service.js';
import { SessionModelKeyStore } from './session-model-key.store.js';

export const SECURE_COOKIE = Symbol('SECURE_COOKIE');
interface CookieResponse {
  cookie(
    name: string,
    value: string,
    options: { httpOnly: boolean; sameSite: 'lax'; path: string; maxAge: number; secure: boolean },
  ): void;
  clearCookie(
    name: string,
    options: { httpOnly: boolean; sameSite: 'lax'; path: string; secure: boolean },
  ): void;
}
const DEMO_MODEL_KEY_COOKIE = 'nexo_demo_model_key';
const demoModelKeyCookieOptions = (secure: boolean) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 900000,
  secure,
});
const demoModelKeyClearCookieOptions = (secure: boolean) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure,
});
@Controller('session')
export class IdentityController {
  constructor(
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(SessionModelKeyStore) private readonly modelKeys: SessionModelKeyStore,
    @Inject(SECURE_COOKIE) private readonly secure: boolean,
  ) {}
  @Post('model-key')
  @HttpCode(201)
  configureModelKey(@Body() body: unknown, @Res({ passthrough: true }) response: CookieResponse) {
    const parsed = DemoModelKeyInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException();
    const temporaryToken = this.modelKeys.create(parsed.data.modelApiKey);
    response.cookie(DEMO_MODEL_KEY_COOKIE, temporaryToken, demoModelKeyCookieOptions(this.secure));
    return { configured: true };
  }
  @Post()
  async login(
    @Body() body: unknown,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const parsed = LoginInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException();
    const result = await this.identity.login(parsed.data);
    const temporaryToken = sessionTokenByName(request.headers.cookie, DEMO_MODEL_KEY_COOKIE);
    this.modelKeys.claim(temporaryToken, result.token);
    response.cookie('nexo_session', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400000,
      secure: this.secure,
    });
    response.clearCookie(DEMO_MODEL_KEY_COOKIE, demoModelKeyClearCookieOptions(this.secure));
    return result.user;
  }
  @Get()
  @UseGuards(IdentityGuard)
  current(@Req() request: AuthRequest) {
    return request.user;
  }
  @Delete()
  @HttpCode(204)
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: CookieResponse) {
    const token = sessionToken(request.headers.cookie);
    this.modelKeys.clear(token);
    await this.identity.logout(token);
    response.clearCookie('nexo_session', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: this.secure,
    });
  }
}

function sessionTokenByName(cookie: string | undefined, name: string): string {
  return (
    cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ''
  );
}
