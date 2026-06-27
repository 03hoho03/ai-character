import { Module } from '@nestjs/common';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { AuthModule } from '../auth/auth.module';

/** #44 스토리 제작 모듈. PrismaService는 전역(PrismaModule), OptionalJwtGuard는 AuthModule에서 주입. */
@Module({
  imports: [AuthModule],
  controllers: [StoriesController],
  providers: [StoriesService],
  exports: [StoriesService], // #45 빌더/런타임이 재사용
})
export class StoriesModule {}
