import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getClientIp } from '../common/client-info';
import { ZodPipe } from '../common/validation';
import { AppConfig } from '../config/app-config';
import { RateLimit } from '../redis/rate-limit';
import { AuthService } from './auth.service';

const LoginBody = z.object({ passphrase: z.string().max(1024) });

@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  @Post('login')
  @HttpCode(200)
  @RateLimit({ name: 'login', limit: 5, windowSec: 60, message: 'Too many attempts — wait a minute and try again.' })
  async login(
    @Body(new ZodPipe(LoginBody)) body: z.infer<typeof LoginBody>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!this.auth.checkPassphrase(body.passphrase)) throw new UnauthorizedException('That passphrase is not right');
    const id = await this.auth.createSession({
      ip: getClientIp(req, this.config.trustProxy),
      userAgent: req.headers['user-agent']?.slice(0, 300),
    });
    this.auth.setCookie(res, id);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.destroySession(this.auth.sessionIdFrom(req));
    this.auth.clearCookie(res);
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: Request) {
    if (!(await this.auth.isAuthenticated(req))) throw new UnauthorizedException('Not signed in');
    return { authenticated: true };
  }
}
