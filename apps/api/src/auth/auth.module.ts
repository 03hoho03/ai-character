import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * #28 인증 모듈. JWT 서명키는 JWT_SECRET env에서 런타임에 읽는다(registerAsync —
 * 모듈 정의 평가 시점이 아니라 DI 초기화 시점이라 테스트의 env 주입과 정합).
 * PrismaService는 전역 PrismaModule에서 주입된다.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
