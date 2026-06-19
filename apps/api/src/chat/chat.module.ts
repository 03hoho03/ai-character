import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { CharactersModule } from '../characters/characters.module';
import { AuthModule } from '../auth/auth.module';
import { GENAI_CLIENT } from './chat.constants';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [CharactersModule, AuthModule], // #23 persona 조회 + #32 OptionalJwtGuard
  controllers: [ChatController],
  providers: [
    ChatService,
    {
      provide: GENAI_CLIENT,
      // 키 미설정 시 null — 부팅은 허용하고 /chat 호출에서 503으로 안내
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('GEMINI_API_KEY');
        return apiKey ? new GoogleGenAI({ apiKey }) : null;
      },
      inject: [ConfigService],
    },
  ],
  exports: [ChatService], // #15 conversations가 요약 생성을 위해 재사용
})
export class ChatModule {}
