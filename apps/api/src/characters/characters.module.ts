import { Module } from '@nestjs/common';
import { CharactersController } from './characters.controller';
import { CharactersService } from './characters.service';
import { AuthModule } from '../auth/auth.module';

/** #16 캐릭터 영속화 모듈. PrismaService는 전역(PrismaModule)에서 주입. #32 OptionalJwtGuard는 AuthModule에서. */
@Module({
  imports: [AuthModule],
  controllers: [CharactersController],
  providers: [CharactersService],
  exports: [CharactersService], // #23 chat이 신뢰 persona 조회를 위해 재사용
})
export class CharactersModule {}
