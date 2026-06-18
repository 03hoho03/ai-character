import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto, SignupDto } from './dto/auth.dto';

/** 응답에 노출 가능한 사용자(비밀번호 해시 제외) */
export type SafeUser = { id: string; email: string; createdAt: Date };

/**
 * #28 인증 서비스. 이메일+비번(argon2 해시) + stateless JWT 발급.
 * 소유 모델(Character/Conversation)은 이 티켓에서 건드리지 않는다(#31/#32).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** 가입 — 중복 email은 409. 성공 시 토큰까지 발급(컨트롤러가 쿠키로 내려준다). */
  async signup(dto: SignupDto): Promise<{ user: SafeUser; token: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('이미 가입된 이메일입니다.');
    }
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash },
    });
    return { user: this.toSafe(user), token: this.sign(user) };
  }

  /** 로그인 — 미존재/불일치 모두 401(존재 비노출). */
  async login(dto: LoginDto): Promise<{ user: SafeUser; token: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const ok = user && (await argon2.verify(user.passwordHash, dto.password));
    if (!user || !ok) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    return { user: this.toSafe(user), token: this.sign(user) };
  }

  private sign(user: { id: string; email: string }): string {
    return this.jwt.sign({ sub: user.id, email: user.email });
  }

  private toSafe(user: { id: string; email: string; createdAt: Date }): SafeUser {
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }
}
