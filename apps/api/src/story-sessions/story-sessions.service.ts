import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GoogleGenAI } from '@google/genai';
import {
  applyStatDeltas,
  buildStoryPrompt,
  buildStoryResponseSchema,
  type ChatMessage,
  type StartSettingDef,
  type StatValues,
  type Story as StoryDomain,
} from '@ai-character/shared';
import { PrismaService } from '../prisma/prisma.service';
import { type OwnerContext, ownerMatches, ownerWhere } from '../auth/owner';
import { GENAI_CLIENT, SAFETY_SETTINGS } from '../chat/chat.constants';

/**
 * #49 세션 영속 + #50 [46b] play turn(delta 서버검증·clamp) 서비스.
 * 신뢰경계(#23, §4.2): 모델 statDeltas를 서버가 화이트리스트+clamp 후에만 적용한다.
 * 엔딩 평가(#51)는 범위 밖 — turn은 delta 갱신까지.
 * 소유자 = OwnerContext(로그인 userId(쿠키) ?? 비로그인 browserId). 불일치/부재는 존재 비노출 404.
 */
@Injectable()
export class StorySessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(GENAI_CLIENT) private readonly client: GoogleGenAI | null,
  ) {}

  /**
   * 세션 생성. 해당 StartSetting의 정규화 Stat[]을 읽어 statValues를 Stat.initialValue로 초기화한다
   * (예 {호감도:0, 신뢰:10}). endedWith는 스키마 기본 null(진행중). 소유는 ownerWhere만 set.
   * startSetting 부재면 404.
   */
  async create(owner: OwnerContext, storyId: string, startSettingId: string) {
    const startSetting = await this.prisma.startSetting.findUnique({
      where: { id: startSettingId },
      include: { stats: true },
    });
    if (!startSetting || startSetting.storyId !== storyId) {
      throw new NotFoundException('시작 설정을 찾을 수 없습니다.');
    }

    // 정규화 Stat[] → Json statValues 초기화(스탯명 → 초기값). #50 delta 전까지 불변.
    const statValues: StatValues = {};
    for (const stat of startSetting.stats) statValues[stat.name] = stat.initialValue;

    return this.prisma.storySession.create({
      data: { ...ownerWhere(owner), storyId, startSettingId, statValues },
    });
  }

  /**
   * 이어하기 — 소유자 세션(현재 statValues/endedWith) 반환. 소유 불일치/부재는 존재 비노출 404.
   * (로그인=userId / 비로그인=browserId 비교, ownerMatches)
   */
  async getByOwner(sessionId: string, owner: OwnerContext) {
    const session = await this.prisma.storySession.findUnique({ where: { id: sessionId } });
    if (!session || !ownerMatches(session, owner)) {
      throw new NotFoundException('세션을 찾을 수 없습니다.');
    }
    return session;
  }

  /**
   * #50 play turn — 사용자 메시지 → 모델 structured 출력 → **서버 검증·clamp** → statValues 갱신.
   * 신뢰경계: buildStoryPrompt/responseSchema는 서버 조회분으로 조립하고, 모델 statDeltas는
   * applyStatDeltas로 화이트리스트+clamp 후에만 영속한다(§4.2). 엔딩 평가는 #51.
   * 소유 불일치/세션·설정 부재는 모델 호출 전 404. 모델 JSON 파싱 실패는 방어(빈 reply, 스탯 불변).
   */
  async turn(sessionId: string, owner: OwnerContext, message: string) {
    const session = await this.prisma.storySession.findUnique({ where: { id: sessionId } });
    if (!session || !ownerMatches(session, owner)) {
      throw new NotFoundException('세션을 찾을 수 없습니다.');
    }
    const startSetting = await this.prisma.startSetting.findUnique({
      where: { id: session.startSettingId },
      include: { stats: true },
    });
    const story = await this.prisma.story.findUnique({ where: { id: session.storyId } });
    if (!startSetting || !story) {
      throw new NotFoundException('스토리 설정을 찾을 수 없습니다.');
    }

    const current = (session.statValues ?? {}) as StatValues;
    // 서버 조회분으로만 프롬프트 재조립(클라 입력 무신뢰, #23). Prisma Json은 도메인 타입으로 취급.
    const prompt = buildStoryPrompt(
      story as unknown as StoryDomain,
      startSetting as unknown as StartSettingDef,
      current,
    );

    const client = this.requireClient();
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
    const contents = this.toContents([
      ...prompt.fewShotMessages,
      { role: 'user', content: message },
    ]);

    // 모델 출력 방어 파싱 — 실패해도 turn은 진행(빈 reply, statDeltas 없음 → 스탯 불변).
    let reply = '';
    let rawDeltas: unknown = {};
    try {
      const result = await client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: prompt.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: buildStoryResponseSchema(
            startSetting as unknown as StartSettingDef,
          ) as unknown as Record<string, unknown>,
          safetySettings: SAFETY_SETTINGS,
        },
      });
      const parsed = this.safeParse(result.text);
      if (parsed) {
        if (typeof parsed.reply === 'string') reply = parsed.reply;
        rawDeltas = parsed.statDeltas;
      }
    } catch {
      // 업스트림/파싱 오류는 방어 — 스탯 불변으로 진행(세션은 깨지지 않는다).
    }

    // 모델 statDeltas를 화이트리스트+clamp 후에만 적용(§4.2 신뢰경계).
    const { statValues, rejectedKeys } = applyStatDeltas(current, startSetting.stats, rawDeltas);
    await this.prisma.storySession.update({
      where: { id: sessionId },
      data: { statValues },
    });

    return { reply, statValues, rejectedKeys };
  }

  /** Gemini 응답 텍스트 → { reply?, statDeltas? } 방어 파싱. 실패/비객체는 null. */
  private safeParse(text: string | undefined): { reply?: unknown; statDeltas?: unknown } | null {
    if (!text) return null;
    try {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed as { reply?: unknown; statDeltas?: unknown };
    } catch {
      return null;
    }
  }

  /** ChatMessage[] → Gemini contents(역할 매핑, persona chat.service 패턴). */
  private toContents(messages: ChatMessage[]) {
    return messages.map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  }

  private requireClient(): GoogleGenAI {
    if (!this.client) {
      throw new ServiceUnavailableException('GEMINI_API_KEY가 설정되지 않았습니다.');
    }
    return this.client;
  }
}
