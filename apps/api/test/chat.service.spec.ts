import {
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ChatMessage, ChatRequest } from '@ai-character/shared';
import { ChatService } from '../src/chat/chat.service';

const cfg = (model?: string) =>
  ({ get: (_key: string, def?: string) => model ?? def }) as never;

const baseRequest: ChatRequest = {
  systemInstruction: '너는 친절한 마법사다.',
  messages: [
    { role: 'user', content: '안녕' },
    { role: 'model', content: '반갑네, 여행자여.' },
    { role: 'user', content: '주문 하나만 알려줘' },
  ],
};

describe('ChatService', () => {
  const generateContent = jest.fn();
  const client = { models: { generateContent } } as never;
  let service: ChatService;

  beforeEach(() => {
    generateContent.mockReset();
    service = new ChatService(client, cfg());
  });

  it('히스토리를 Gemini contents 형식으로 매핑하고 systemInstruction을 전달한다', async () => {
    generateContent.mockResolvedValue({ text: '룬을 그리거라.' });

    const res = await service.chat(baseRequest);

    expect(generateContent).toHaveBeenCalledTimes(1);
    const callArg = generateContent.mock.calls[0][0];
    expect(callArg.model).toBe('gemini-2.5-flash');
    expect(callArg.contents).toEqual([
      { role: 'user', parts: [{ text: '안녕' }] },
      { role: 'model', parts: [{ text: '반갑네, 여행자여.' }] },
      { role: 'user', parts: [{ text: '주문 하나만 알려줘' }] },
    ]);
    expect(callArg.config?.systemInstruction).toBe('너는 친절한 마법사다.');
    expect(res).toEqual({ message: { role: 'model', content: '룬을 그리거라.' } });
  });

  it('systemInstruction이 없으면 config에 전달하지 않는다', async () => {
    generateContent.mockResolvedValue({ text: 'ok' });

    await service.chat({ messages: [{ role: 'user', content: 'hi' }] });

    const callArg = generateContent.mock.calls[0][0];
    expect(callArg.config?.systemInstruction).toBeUndefined();
  });

  it('GEMINI_MODEL 설정이 있으면 그 모델명을 사용한다', async () => {
    generateContent.mockResolvedValue({ text: 'ok' });
    const customService = new ChatService(client, cfg('gemini-custom'));

    await customService.chat({ messages: [{ role: 'user', content: 'hi' }] });

    expect(generateContent.mock.calls[0][0].model).toBe('gemini-custom');
  });

  it('업스트림 호출 실패 시 502 BadGatewayException으로 매핑한다', async () => {
    generateContent.mockRejectedValue(new Error('401 API key not valid'));

    await expect(service.chat(baseRequest)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('응답 text가 비어있으면 502로 매핑한다', async () => {
    generateContent.mockResolvedValue({ text: undefined });

    await expect(service.chat(baseRequest)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('30초 타임아웃 시 504 GatewayTimeoutException을 던진다', async () => {
    jest.useFakeTimers();
    try {
      generateContent.mockReturnValue(new Promise(() => undefined)); // 영영 미해결

      const assertion = expect(service.chat(baseRequest)).rejects.toBeInstanceOf(
        GatewayTimeoutException,
      );
      await jest.advanceTimersByTimeAsync(30_001);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });

  it('클라이언트 미구성(키 없음) 시 503 ServiceUnavailableException을 던진다', async () => {
    const noKeyService = new ChatService(null, cfg());

    await expect(noKeyService.chat(baseRequest)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  describe('conversationSummary 주입 (#15)', () => {
    it('conversationSummary가 있으면 systemInstruction에 요약 블록을 접합한다', async () => {
      generateContent.mockResolvedValue({ text: 'ok' });

      await service.chat({ ...baseRequest, conversationSummary: '주인공은 마법사를 만났다.' });

      const si = generateContent.mock.calls[0][0].config.systemInstruction as string;
      expect(si).toContain('너는 친절한 마법사다.'); // 원본 유지
      expect(si).toContain('주인공은 마법사를 만났다.'); // 요약 접합
    });

    it('conversationSummary가 없으면 systemInstruction을 그대로 둔다', async () => {
      generateContent.mockResolvedValue({ text: 'ok' });

      await service.chat(baseRequest);

      expect(generateContent.mock.calls[0][0].config.systemInstruction).toBe('너는 친절한 마법사다.');
    });
  });

  describe('summarize (#15)', () => {
    const turns: ChatMessage[] = [
      { role: 'user', content: '마법을 배우고 싶어' },
      { role: 'model', content: '룬부터 익히거라' },
    ];

    it('Gemini로 요약을 생성해 문자열로 반환하고, 대화 내용을 프롬프트에 담는다', async () => {
      generateContent.mockResolvedValue({ text: '사용자는 마법 입문을 원했고 룬 학습을 안내받았다.' });

      const out = await service.summarize(null, turns);

      expect(out).toBe('사용자는 마법 입문을 원했고 룬 학습을 안내받았다.');
      const prompt = generateContent.mock.calls[0][0].contents[0].parts[0].text as string;
      expect(prompt).toContain('마법을 배우고 싶어');
      expect(prompt).toContain('룬부터 익히거라');
    });

    it('직전 요약을 누적 반영한다 (프롬프트에 포함)', async () => {
      generateContent.mockResolvedValue({ text: '갱신된 요약' });

      await service.summarize('기존 요약 내용', turns);

      const prompt = generateContent.mock.calls[0][0].contents[0].parts[0].text as string;
      expect(prompt).toContain('기존 요약 내용');
    });

    it('빈 응답이면 502로 매핑한다', async () => {
      generateContent.mockResolvedValue({ text: undefined });
      await expect(service.summarize(null, turns)).rejects.toBeInstanceOf(BadGatewayException);
    });
  });
});
