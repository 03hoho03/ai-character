import type { TestingModuleBuilder } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * #14 chat HTTP 계약 테스트는 전체 AppModule을 부팅하지만 DB를 쓰지 않는다.
 * PrismaService를 no-op 스텁으로 교체해 onModuleInit의 $connect 실패를 피한다.
 */
const prismaStub = {
  onModuleInit: async () => {},
  onModuleDestroy: async () => {},
  $connect: async () => {},
  $disconnect: async () => {},
} as unknown as PrismaService;

export function stubPrisma(builder: TestingModuleBuilder): TestingModuleBuilder {
  return builder.overrideProvider(PrismaService).useValue(prismaStub);
}
