import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * #43 스토리 스키마 토대 단언(DB 비의존).
 * 존재가 아니라 *내용*을 단언(l_2026_06_18_x): Stat은 정규화 컬럼, Json은 Json, ownerContext 이중축.
 * sprint-pm Phase 5 break 잠금: Stat=정규화 / Ending.condition·statValues·dev예시·추천답변·shortcuts=Json.
 */
describe('Story 스키마 토대 (#43)', () => {
  const schema = readFileSync(
    join(__dirname, '..', 'prisma', 'schema.prisma'),
    'utf8',
  );
  const blockOf = (model: string) =>
    schema.match(new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? '';

  describe('5모델 존재', () => {
    it.each(['Story', 'StartSetting', 'Stat', 'Ending', 'StorySession'])(
      'model %s 블록이 추출된다',
      (m) => {
        expect(blockOf(m)).toContain(`model ${m}`);
      },
    );
  });

  describe('Story — ownerContext 이중축 + Json 필드', () => {
    const b = blockOf('Story');
    it('id는 서버 cuid()', () => {
      expect(b).toMatch(/\bid\s+String\s+@id\s+@default\(cuid\(\)\)/);
    });
    it('ownerContext: userId/browserId nullable + user relation (Character 패턴 복제)', () => {
      expect(b).toMatch(/\buserId\s+String\?/);
      expect(b).toMatch(/\bbrowserId\s+String\?/);
      expect(b).toMatch(/\buser\s+User\?\s+@relation\(fields:\s*\[userId\]/);
    });
    it('developmentExamples·shortcuts는 Json', () => {
      expect(b).toMatch(/\bdevelopmentExamples\s+Json/);
      expect(b).toMatch(/\bshortcuts\s+Json/);
    });
    it('contentRating 기본 all, visibility 기본 private, commentsClosed 기본 false', () => {
      expect(b).toMatch(/\bcontentRating\s+String\s+@default\("all"\)/);
      expect(b).toMatch(/\bvisibility\s+String\s+@default\("private"\)/);
      expect(b).toMatch(/\bcommentsClosed\s+Boolean\s+@default\(false\)/);
    });
    it('storyInfo·name·tagline 보유', () => {
      expect(b).toMatch(/\bstoryInfo\s+String/);
      expect(b).toMatch(/\bname\s+String/);
      expect(b).toMatch(/\btagline\s+String/);
    });
    it('startSettings·sessions 역방향 relation', () => {
      expect(b).toMatch(/\bstartSettings\s+StartSetting\[\]/);
      expect(b).toMatch(/\bsessions\s+StorySession\[\]/);
    });
    it('소유 조회 인덱스 @@index([userId])·([browserId]) (Character 패턴)', () => {
      expect(b).toMatch(/@@index\(\[userId\]\)/);
      expect(b).toMatch(/@@index\(\[browserId\]\)/);
    });
  });

  describe('StartSetting — Story 자식 + suggestedReplies Json', () => {
    const b = blockOf('StartSetting');
    it('storyId + Story relation(onDelete Cascade)', () => {
      expect(b).toMatch(/\bstoryId\s+String/);
      expect(b).toMatch(
        /\bstory\s+Story\s+@relation\(fields:\s*\[storyId\][\s\S]*?onDelete:\s*Cascade/,
      );
    });
    it('prologue·startSituation·playGuide·name', () => {
      expect(b).toMatch(/\bprologue\s+String/);
      expect(b).toMatch(/\bstartSituation\s+String/);
      expect(b).toMatch(/\bplayGuide\s+String\?/);
      expect(b).toMatch(/\bname\s+String/);
    });
    it('suggestedReplies는 Json', () => {
      expect(b).toMatch(/\bsuggestedReplies\s+Json/);
    });
    it('stats·endings 역방향 relation', () => {
      expect(b).toMatch(/\bstats\s+Stat\[\]/);
      expect(b).toMatch(/\bendings\s+Ending\[\]/);
    });
  });

  describe('Stat — 정규화 테이블 (Json 아님)', () => {
    const b = blockOf('Stat');
    it('정규화 컬럼: name + initialValue/minValue/maxValue Int', () => {
      expect(b).toMatch(/\bname\s+String/);
      expect(b).toMatch(/\binitialValue\s+Int/);
      expect(b).toMatch(/\bminValue\s+Int/);
      expect(b).toMatch(/\bmaxValue\s+Int/);
    });
    it('StartSetting 자식(onDelete Cascade)', () => {
      expect(b).toMatch(
        /\bstartSetting\s+StartSetting\s+@relation\([\s\S]*?onDelete:\s*Cascade/,
      );
    });
    it('@@unique([startSettingId, name]) — 시작설정 내 스탯명 중복 금지', () => {
      expect(b).toMatch(/@@unique\(\[startSettingId,\s*name\]\)/);
    });
  });

  describe('Ending — condition Json 규칙', () => {
    const b = blockOf('Ending');
    it('condition은 Json([{stat,op,value}] AND)', () => {
      expect(b).toMatch(/\bcondition\s+Json/);
    });
    it('resultText·name·priority', () => {
      expect(b).toMatch(/\bresultText\s+String/);
      expect(b).toMatch(/\bname\s+String/);
      expect(b).toMatch(/\bpriority\s+Int\s+@default\(0\)/);
    });
    it('StartSetting 자식(onDelete Cascade)', () => {
      expect(b).toMatch(
        /\bstartSetting\s+StartSetting\s+@relation\([\s\S]*?onDelete:\s*Cascade/,
      );
    });
  });

  describe('StorySession — 런타임 가변상태', () => {
    const b = blockOf('StorySession');
    it('statValues는 Json(런타임 가변)', () => {
      expect(b).toMatch(/\bstatValues\s+Json/);
    });
    it('endedWith nullable(Ending id)', () => {
      expect(b).toMatch(/\bendedWith\s+String\?/);
    });
    it('storyId·startSettingId 보유', () => {
      expect(b).toMatch(/\bstoryId\s+String/);
      expect(b).toMatch(/\bstartSettingId\s+String/);
    });
    it('ownerContext: userId/browserId nullable', () => {
      expect(b).toMatch(/\buserId\s+String\?/);
      expect(b).toMatch(/\bbrowserId\s+String\?/);
    });
    it('Story relation(onDelete Cascade)', () => {
      expect(b).toMatch(
        /\bstory\s+Story\s+@relation\(fields:\s*\[storyId\][\s\S]*?onDelete:\s*Cascade/,
      );
    });
    it('소유 조회 인덱스 @@index([userId])·([browserId])', () => {
      expect(b).toMatch(/@@index\(\[userId\]\)/);
      expect(b).toMatch(/@@index\(\[browserId\]\)/);
    });
  });

  describe('User 역방향 relation', () => {
    const b = blockOf('User');
    it('stories·storySessions 추가', () => {
      expect(b).toMatch(/\bstories\s+Story\[\]/);
      expect(b).toMatch(/\bstorySessions\s+StorySession\[\]/);
    });
  });
});
