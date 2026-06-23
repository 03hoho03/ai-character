import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ChatModule } from '../chat/chat.module';
import { AuthModule } from '../auth/auth.module';

/**
 * #14 대화 영속화 모듈. PrismaService는 전역(PrismaModule), ChatService는 #15 요약용으로 ChatModule에서 주입.
 * #40 OwnerContext 전환 — OptionalJwtGuard 사용을 위해 AuthModule import.
 */
@Module({
  imports: [ChatModule, AuthModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
