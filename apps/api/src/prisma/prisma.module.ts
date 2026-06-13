import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** #14 전역 Prisma 모듈 — 다른 모듈에서 PrismaService 주입 가능. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
