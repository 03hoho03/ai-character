import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AUTH_COOKIE } from './jwt-auth.guard';

/**
 * #32 선택적 JWT 가드 — 소유 경로용. 쿠키 JWT가 있으면 검증해 req.user 주입,
 * 없거나 무효(만료/위조)면 *통과*(req.user 미설정)해 비로그인 browserId 폴백을 허용한다.
 * 무효 토큰을 401로 막지 않는 이유: 만료 쿠키를 든 사용자도 익명 흐름으로 동작해야 한다(MVP-thin).
 * 무효 토큰으로 userId 소유를 얻을 수는 없다(req.user가 채워지지 않음).
 */
@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: unknown; cookies?: Record<string, string> }>();
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) return true; // 비로그인 — browserId 폴백
    try {
      const payload = this.jwt.verify<{ sub: string; email: string }>(token);
      req.user = { userId: payload.sub, email: payload.email };
    } catch {
      // 무효 토큰은 익명 취급(통과) — userId는 부여되지 않는다
    }
    return true;
  }
}
