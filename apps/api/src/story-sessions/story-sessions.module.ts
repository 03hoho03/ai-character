import { Module } from '@nestjs/common';
import { StorySessionsController } from './story-sessions.controller';
import { StorySessionsService } from './story-sessions.service';
import { AuthModule } from '../auth/auth.module';

/**
 * #49 플레이 세션 영속 모듈(#44 stories 제작 모듈과 분리).
 * PrismaService는 전역(PrismaModule). OptionalJwtGuard 사용을 위해 AuthModule import(#40 패턴).
 */
@Module({
  imports: [AuthModule],
  controllers: [StorySessionsController],
  providers: [StorySessionsService],
})
export class StorySessionsModule {}
