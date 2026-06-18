/**
 * #24 /discover 페이지 — 공개 캐릭터 목록 + 키워드 검색 상호작용.
 * characters-api를 모킹해 fetchPublicCharacters 호출과 렌더를 검증한다.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterRecord } from '@ai-character/shared';

vi.mock('../../lib/characters-api', () => ({
  fetchPublicCharacters: vi.fn(),
}));

import { fetchPublicCharacters } from '../../lib/characters-api';
import DiscoverPage from './page';

const mockFetch = fetchPublicCharacters as unknown as ReturnType<typeof vi.fn>;

const char = (name: string, over: Partial<CharacterRecord> = {}): CharacterRecord => ({
  id: `usr-${name}`,
  browserId: 'owner',
  name,
  tagline: `${name} 소개`,
  personality: '성격',
  speechStyle: '말투',
  worldview: '세계관',
  greeting: '안녕',
  exampleDialogue: [{ user: 'u', model: 'm' }],
  prohibitions: [],
  isPublic: true,
  createdAt: '2026-06-18',
  updatedAt: '2026-06-18',
  ...over,
});

describe('DiscoverPage (#24)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue([char('엘베리아')]);
  });
  afterEach(() => cleanup());

  it('마운트 시 공개 캐릭터를 로드해 렌더한다', async () => {
    render(<DiscoverPage />);

    await waitFor(() => expect(screen.getByText('엘베리아')).toBeTruthy());
    expect(mockFetch).toHaveBeenCalled();
  });

  it('검색어 제출 시 fetchPublicCharacters(q, filters)로 다시 조회하고 결과를 렌더한다', async () => {
    mockFetch.mockResolvedValueOnce([char('엘베리아')]); // 초기 로드
    render(<DiscoverPage />);
    await waitFor(() => expect(screen.getByText('엘베리아')).toBeTruthy());

    mockFetch.mockResolvedValueOnce([char('마법사')]); // 검색 결과
    fireEvent.change(screen.getByPlaceholderText('캐릭터 검색'), { target: { value: '마법' } });
    fireEvent.submit(screen.getByRole('search'));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith('마법', {
        category: undefined,
        tag: undefined,
        includeAdult: false,
      }),
    );
    await waitFor(() => expect(screen.getByText('마법사')).toBeTruthy());
  });

  // #25 태그/카테고리 필터
  it('태그 칩 클릭 시 해당 tag 필터로 재조회하고 활성 필터를 노출한다', async () => {
    mockFetch.mockResolvedValueOnce([char('엘베리아', { tags: ['마법'] })]); // 초기
    render(<DiscoverPage />);
    await waitFor(() => expect(screen.getByText('#마법')).toBeTruthy());

    mockFetch.mockResolvedValueOnce([char('간달프', { tags: ['마법'] })]); // 태그 필터 결과
    fireEvent.click(screen.getByText('#마법'));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenLastCalledWith('', {
        category: undefined,
        tag: '마법',
        includeAdult: false,
      }),
    );
    await waitFor(() => expect(screen.getByText('간달프')).toBeTruthy());
    // 활성 필터 바에 해제 버튼 노출
    expect(screen.getByText('#마법 ✕')).toBeTruthy();
  });

  it('카테고리 칩 클릭 시 해당 category 필터로 재조회한다', async () => {
    mockFetch.mockResolvedValueOnce([char('엘베리아', { category: '판타지' })]); // 초기
    render(<DiscoverPage />);
    await waitFor(() => expect(screen.getByText('판타지')).toBeTruthy());

    mockFetch.mockResolvedValueOnce([char('엘베리아', { category: '판타지' })]);
    fireEvent.click(screen.getByText('판타지'));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenLastCalledWith('', {
        category: '판타지',
        tag: undefined,
        includeAdult: false,
      }),
    );
    expect(screen.getByText('카테고리: 판타지 ✕')).toBeTruthy();
  });

  // #26 성인 콘텐츠 토글 + 배지
  it('성인 콘텐츠 포함 토글 시 includeAdult=true로 재조회한다(안전 기본 off)', async () => {
    mockFetch.mockResolvedValueOnce([char('엘베리아')]); // 초기(일반만)
    render(<DiscoverPage />);
    await waitFor(() => expect(screen.getByText('엘베리아')).toBeTruthy());

    mockFetch.mockResolvedValueOnce([char('성인캐릭', { contentRating: 'adult' })]);
    fireEvent.click(screen.getByLabelText('성인 콘텐츠 포함'));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenLastCalledWith('', {
        category: undefined,
        tag: undefined,
        includeAdult: true,
      }),
    );
    // 성인 캐릭터 카드에 19 배지 노출
    await waitFor(() => expect(screen.getByText('19')).toBeTruthy());
  });

  it('결과가 없으면 빈 상태 문구를 노출한다', async () => {
    mockFetch.mockResolvedValue([]);
    render(<DiscoverPage />);

    await waitFor(() => expect(screen.getByText(/공개 캐릭터가 없습니다|결과가 없습니다/)).toBeTruthy());
  });
});
