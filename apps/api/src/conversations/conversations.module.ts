import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

/** #14 대화 영속화 모듈. PrismaService는 전역(PrismaModule)에서 주입. */
@Module({
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
