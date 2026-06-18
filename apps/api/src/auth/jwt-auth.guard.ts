import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

/** JWT 쿠키 이름 — 발급/검증 단일 출처 */
export const AUTH_COOKIE = 'access_token';

/**
 * #28 쿠키 JWT 인증 가드. httpOnly 쿠키에서 토큰을 꺼내 검증하고 req.user={userId,email} 주입.
 * 신원은 쿠키에서만 — body/query의 userId는 신뢰하지 않는다(#23 신뢰경계 일관).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: unknown; cookies?: Record<string, string> }>();
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = this.jwt.verify<{ sub: string; email: string }>(token);
      req.user = { userId: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
