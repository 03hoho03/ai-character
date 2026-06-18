/**
 * #21 character-store 단위 테스트 — 서버 백드 외부스토어로 재작성.
 * fetch를 method/url로 라우팅해 모킹. 순수 함수(sanitize/resolve/newDraft/createId)는 #6에서 보존.
 * 모듈 싱글톤(cache/loaded/loadPromise)을 테스트마다 초기화하려 vi.resetModules + 동적 import 사용.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERSONA_TEMPLATES, type Persona } from '@ai-character/shared';

const BASE = 'http://localhost:4000';
const OLD_KEY = 'ai-character:user-characters';
const MIGRATED_KEY = 'ai-character:characters-migrated';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const validDraft = (over: Partial<Persona> = {}): Persona => ({
  id: 'usr-test-1',
  name: '나의 캐릭터',
  tagline: '한줄소개',
  personality: '성격',
  speechStyle: '말투',
  worldview: '세계관',
  greeting: '안녕!',
  exampleDialogue: [{ user: '안녕?', model: '응 안녕!' }],
  prohibitions: ['금지1'],
  ...over,
});

type Call = { url: string; method: string; body?: Record<string, unknown> };

describe('character-store (#21 서버 백드)', () => {
  const fetchMock = vi.fn();
  let calls: Call[];
  /** GET /characters 가 돌려줄 서버 목록 — 테스트가 조정 */
  let serverList: Persona[];

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    localStorage.setItem('ai-character:browser-id', 'b1');
    calls = [];
    serverList = [];
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ url, method, body });
      if (method === 'GET') return jsonResponse(serverList);
      if (method === 'POST') return jsonResponse(body); // upsert echo
      if (method === 'PATCH') {
        // 서버는 경로 id를 포함한 full record를 반환한다
        const id = url.split('/').pop();
        return jsonResponse({ id, ...(body ?? {}) });
      }
      if (method === 'DELETE') return new Response(null, { status: 204 });
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  const load = () => import('./character-store');
  const get = (m: string) => calls.filter((c) => c.method === m);

  describe('ensureLoaded — 서버에서 목록 로드', () => {
    it('GET /characters?browserId= 로 소유 캐릭터를 읽어 캐시에 담는다', async () => {
      serverList = [validDraft()];
      const store = await load();

      await store.ensureLoaded();

      expect(store.listUserCharacters()).toEqual(serverList);
      expect(store.isCharactersLoaded()).toBe(true);
      const g = get('GET')[0];
      expect(g.url).toBe(`${BASE}/characters?browserId=b1`);
    });

    it('동시/반복 호출에도 GET은 1회만 (in-flight 가드)', async () => {
      serverList = [validDraft()];
      const store = await load();

      await Promise.all([store.ensureLoaded(), store.ensureLoaded()]);
      await store.ensureLoaded();

      expect(get('GET')).toHaveLength(1);
    });
  });

  describe('saveUserCharacter — 서버 반영', () => {
    it('캐시에 없으면 POST(생성/upsert) 후 목록에 추가된다', async () => {
      const store = await load();
      await store.ensureLoaded(); // 빈 서버

      const p = validDraft();
      await store.saveUserCharacter(p);

      const post = get('POST').find((c) => c.url === `${BASE}/characters`);
      expect(post?.body).toMatchObject({ id: p.id, browserId: 'b1', isPublic: false });
      expect(store.getUserCharacter(p.id)?.name).toBe('나의 캐릭터');
    });

    it('캐시에 있으면 PATCH(부분 갱신)로 보낸다', async () => {
      serverList = [validDraft()];
      const store = await load();
      await store.ensureLoaded();

      await store.saveUserCharacter(validDraft({ name: '수정됨' }));

      const patch = get('PATCH').find((c) => c.url === `${BASE}/characters/usr-test-1`);
      expect(patch).toBeTruthy();
      expect(patch?.body).toMatchObject({ name: '수정됨', browserId: 'b1' });
      expect(patch?.body).not.toHaveProperty('id'); // id는 경로로, 본문 제외
      expect(store.getUserCharacter('usr-test-1')?.name).toBe('수정됨');
    });

    it('save는 list 스냅샷 참조를 교체한다 (제자리 변형 금지)', async () => {
      serverList = [validDraft()];
      const store = await load();
      await store.ensureLoaded();
      const before = store.listUserCharacters();

      await store.saveUserCharacter(validDraft({ name: '수정됨' }));

      expect(store.listUserCharacters()).not.toBe(before);
    });
  });

  describe('removeUserCharacter — 서버 반영', () => {
    it('DELETE 후 목록에서 사라진다', async () => {
      serverList = [validDraft()];
      const store = await load();
      await store.ensureLoaded();

      await store.removeUserCharacter('usr-test-1');

      expect(get('DELETE')[0].url).toBe(`${BASE}/characters/usr-test-1?browserId=b1`);
      expect(store.getUserCharacter('usr-test-1')).toBeUndefined();
      expect(store.listUserCharacters()).toHaveLength(0);
    });
  });

  describe('일회성 마이그레이션 (자동 import + 원본 보존)', () => {
    it('localStorage 캐릭터를 POST upsert로 보내고 migrated 플래그를 세우며 원본을 보존한다', async () => {
      const legacy = validDraft({ id: 'usr-legacy' });
      localStorage.setItem(OLD_KEY, JSON.stringify([legacy]));
      const store = await load();

      await store.ensureLoaded();

      // (a) 마이그레이션 POST 전송
      const post = get('POST').find((c) => c.body?.id === 'usr-legacy');
      expect(post?.url).toBe(`${BASE}/characters`);
      expect(post?.body).toMatchObject({ browserId: 'b1', isPublic: false });
      // (b) 플래그
      expect(localStorage.getItem(MIGRATED_KEY)).toBeTruthy();
      // (c) 원본 보존
      expect(localStorage.getItem(OLD_KEY)).toBe(JSON.stringify([legacy]));
    });

    it('migrated 플래그가 있으면 2회차는 import POST를 보내지 않는다', async () => {
      localStorage.setItem(OLD_KEY, JSON.stringify([validDraft({ id: 'usr-legacy' })]));
      localStorage.setItem(MIGRATED_KEY, '1');
      const store = await load();

      await store.ensureLoaded();

      expect(get('POST')).toHaveLength(0);
    });
  });

  describe('순수 함수 보존 (#6)', () => {
    it('createCharacterId: usr- prefix, 호출마다 고유', async () => {
      const { createCharacterId } = await load();
      expect(createCharacterId().startsWith('usr-')).toBe(true);
      expect(createCharacterId()).not.toBe(createCharacterId());
    });
    it('newDraftFromTemplate: 깊은 복사 + 새 usr- id', async () => {
      const { newDraftFromTemplate } = await load();
      const tpl = PERSONA_TEMPLATES[0];
      const snapshot = structuredClone(tpl);
      const draft = newDraftFromTemplate(tpl);
      draft.name = '바뀜';
      expect(draft.id.startsWith('usr-')).toBe(true);
      expect(draft.id).not.toBe(tpl.id);
      expect(tpl).toEqual(snapshot);
    });
    it('sanitizeForSave: name 공백 거부 / 빈 turn·prohibition 필터', async () => {
      const { sanitizeForSave } = await load();
      expect(sanitizeForSave(validDraft({ name: '  ' })).ok).toBe(false);
      const r = sanitizeForSave(
        validDraft({
          exampleDialogue: [
            { user: '유효', model: '응답' },
            { user: '', model: 'x' },
          ],
          prohibitions: ['진짜', '  '],
        }),
      );
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.persona.exampleDialogue).toEqual([{ user: '유효', model: '응답' }]);
        expect(r.persona.prohibitions).toEqual(['진짜']);
      }
    });
    it('sanitizeForSave: #25 category 트림(빈값 undefined) / tags 트림·빈값·중복 제거', async () => {
      const { sanitizeForSave } = await load();

      const r = sanitizeForSave(
        validDraft({ category: '  판타지  ', tags: ['마법', ' 마법 ', '', '엘프'] }),
      );
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.persona.category).toBe('판타지');
        expect(r.persona.tags).toEqual(['마법', '엘프']);
      }

      const empty = sanitizeForSave(validDraft({ category: '   ', tags: ['', '  '] }));
      expect(empty.ok).toBe(true);
      if (empty.ok) {
        expect(empty.persona.category).toBeUndefined();
        expect(empty.persona.tags).toBeUndefined();
      }
    });
    it('resolvePersona: 템플릿 우선 + 사용자 목록 합류', async () => {
      const { resolvePersona } = await load();
      const tpl = PERSONA_TEMPLATES[0];
      const mine = validDraft({ id: 'usr-x' });
      expect(resolvePersona(tpl.id, [])).toEqual(tpl);
      expect(resolvePersona('usr-x', [mine])).toEqual(mine);
      expect(resolvePersona('usr-ghost', [])).toBeUndefined();
    });
  });
});
