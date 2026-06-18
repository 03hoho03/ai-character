/**
 * #21 characters API 클라이언트 테스트 — fetch 모킹. #16 백엔드 엔드포인트에 매핑.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Persona } from '@ai-character/shared';
import {
  createCharacter,
  deleteCharacter,
  fetchOwnedCharacters,
  updateCharacter,
} from './characters-api';

const BASE = 'http://localhost:4000';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const persona = (over: Partial<Persona> = {}): Persona => ({
  id: 'usr-1',
  name: '캐릭터',
  tagline: '한줄',
  personality: '성격',
  speechStyle: '말투',
  worldview: '세계관',
  greeting: '안녕',
  exampleDialogue: [{ user: 'u', model: 'm' }],
  prohibitions: ['금지'],
  ...over,
});

describe('characters-api (#21)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('fetchOwnedCharacters', () => {
    it('GET /characters?browserId= 로 호출하고 배열을 반환한다', async () => {
      const list = [persona()];
      fetchMock.mockResolvedValueOnce(jsonResponse(list));

      const result = await fetchOwnedCharacters('b1');

      expect(result).toEqual(list);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/characters?browserId=b1`);
      expect((init as RequestInit | undefined)?.method ?? 'GET').toBe('GET');
    });

    it('실패(non-ok)면 빈 배열을 반환한다 (읽기 best-effort)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'err' }, 500));
      expect(await fetchOwnedCharacters('b1')).toEqual([]);
    });

    it('네트워크 에러면 빈 배열을 반환한다', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network'));
      expect(await fetchOwnedCharacters('b1')).toEqual([]);
    });
  });

  describe('createCharacter', () => {
    it('POST /characters 에 persona + browserId + isPublic=false 를 보낸다', async () => {
      const p = persona();
      fetchMock.mockResolvedValueOnce(jsonResponse(p));

      const result = await createCharacter(p, 'b1');

      expect(result).toEqual(p);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/characters`);
      expect((init as RequestInit).method).toBe('POST');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toMatchObject({ id: 'usr-1', browserId: 'b1', isPublic: false, name: '캐릭터' });
    });

    it('non-ok면 throw (쓰기 실패 전파)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'nf' }, 404));
      await expect(createCharacter(persona(), 'b1')).rejects.toThrow();
    });
  });

  describe('updateCharacter', () => {
    it('PATCH /characters/:id 에 patch + browserId 를 보낸다 (id는 본문에서 제외)', async () => {
      const updated = persona({ name: '수정' });
      fetchMock.mockResolvedValueOnce(jsonResponse(updated));

      const result = await updateCharacter('usr-1', { name: '수정' }, 'b1');

      expect(result).toEqual(updated);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/characters/usr-1`);
      expect((init as RequestInit).method).toBe('PATCH');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toEqual({ name: '수정', browserId: 'b1' });
    });

    it('non-ok면 throw', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'nf' }, 404));
      await expect(updateCharacter('usr-1', { name: 'x' }, 'b1')).rejects.toThrow();
    });
  });

  describe('deleteCharacter', () => {
    it('DELETE /characters/:id?browserId= 로 호출한다', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

      await deleteCharacter('usr-1', 'b1');

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${BASE}/characters/usr-1?browserId=b1`);
      expect((init as RequestInit).method).toBe('DELETE');
    });

    it('non-ok면 throw', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'nf' }, 404));
      await expect(deleteCharacter('usr-1', 'b1')).rejects.toThrow();
    });
  });
});
