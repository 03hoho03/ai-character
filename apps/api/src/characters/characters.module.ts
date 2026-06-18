import { Module } from '@nestjs/common';
import { CharactersController } from './characters.controller';
import { CharactersService } from './characters.service';

/** #16 캐릭터 영속화 모듈. PrismaService는 전역(PrismaModule)에서 주입. */
@Module({
  controllers: [CharactersController],
  providers: [CharactersService],
})
export class CharactersModule {}
