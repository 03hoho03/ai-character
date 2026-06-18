import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, type SafeUser } from './auth.service';
import { LoginDto, SignupDto } from './dto/auth.dto';
import { AUTH_COOKIE, JwtAuthGuard } from './jwt-auth.guard';

/** JWT 쿠키 수명 — 7일(ms). Set-Cookie Max-Age는 초(604800)로 직렬화된다. */
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * #28 인증 컨트롤러. signup/login은 httpOnly JWT 쿠키를 발급, me는 가드로 보호.
 * @Res({ passthrough: true })로 쿠키만 직접 쓰고 본문 직렬화는 Nest에 위임한다.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SafeUser> {
    const { user, token } = await this.auth.signup(dto);
    this.setAuthCookie(res, token);
    return user;
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SafeUser> {
    const { user, token } = await this.auth.login(dto);
    this.setAuthCookie(res, token);
    return user;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user: { userId: string; email: string } }) {
    return req.user;
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE);
    return { ok: true };
  }

  private setAuthCookie(res: Response, token: string): void {
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE_MS,
    });
  }
}
