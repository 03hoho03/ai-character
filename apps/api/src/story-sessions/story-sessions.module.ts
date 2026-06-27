import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { StorySessionsController } from './story-sessions.controller';
import { StorySessionsService } from './story-sessions.service';
import { AuthModule } from '../auth/auth.module';
import { GENAI_CLIENT } from '../chat/chat.constants';

/**
 * #49 세션 영속 + #50 play turn 모듈(#44 stories 제작 모듈과 분리).
 * PrismaService는 전역(PrismaModule). OptionalJwtGuard 사용을 위해 AuthModule import(#40 패턴).
 * #50 turn이 Gemini structured output을 호출하므로 GENAI_CLIENT를 ChatModule과 동일 팩토리로 제공
 * (키 미설정 시 null → turn에서 503). 테스트는 이 토큰을 override.
 */
@Module({
  imports: [AuthModule],
  controllers: [StorySessionsController],
  providers: [
    StorySessionsService,
    {
      provide: GENAI_CLIENT,
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('GEMINI_API_KEY');
        return apiKey ? new GoogleGenAI({ apiKey }) : null;
      },
      inject: [ConfigService],
    },
  ],
})
export class StorySessionsModule {}
