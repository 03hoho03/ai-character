/**
 * #47 StoryForm 테스트 — 4탭 렌더/전환, 다중 StartSetting·스탯·엔딩 동적 행 추가·삭제,
 * 필수 누락 제출 차단, 제출 시 CreateStoryRequest 형태(중첩 startSettings/stats/endings,
 * 엔딩 condition=[{stat,op,value}] 직렬화) onSubmit payload 단언.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreateStoryRequest } from '@ai-character/shared';
import { StoryForm } from './story-form';

afterEach(cleanup);

function tab(label: string) {
  fireEvent.click(screen.getByRole('tab', { name: label }));
}

/** label로 input/textarea 값 채우기 */
function fill(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
}

describe('StoryForm (#47)', () => {
  it('4개 탭을 렌더하고 탭 전환으로 패널을 바꾼다', () => {
    render(<StoryForm submitLabel="저장" onSubmit={vi.fn()} />);
    for (const label of ['프로필', '스토리 설정', '시작 설정', '등록']) {
      expect(screen.getByRole('tab', { name: label })).toBeTruthy();
    }
    // 기본 프로필 탭
    expect(screen.getByText('대표 이미지 URL (선택)')).toBeTruthy();
    // 등록 탭 전환
    tab('등록');
    expect(screen.getByText('공개 범위')).toBeTruthy();
  });

  it('필수(name/tagline/storyInfo) 누락 시 제출을 차단하고 onSubmit 미호출', () => {
    const onSubmit = vi.fn();
    render(<StoryForm submitLabel="저장" onSubmit={onSubmit} />);
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('스토리 이름은 비워둘 수 없어요.')).toBeTruthy();
  });

  it('시작 설정을 추가/삭제할 수 있다(다중)', () => {
    render(<StoryForm submitLabel="저장" onSubmit={vi.fn()} />);
    tab('시작 설정');
    expect(screen.getByText('시작 설정 (1개)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+ 시작 설정 추가' }));
    expect(screen.getByText('시작 설정 (2개)')).toBeTruthy();
    // 두 번째 시작 설정 삭제
    fireEvent.click(screen.getAllByRole('button', { name: '이 시작 설정 삭제' })[1]);
    expect(screen.getByText('시작 설정 (1개)')).toBeTruthy();
  });

  it('스탯·엔딩 동적 행을 추가/삭제할 수 있다', () => {
    render(<StoryForm submitLabel="저장" onSubmit={vi.fn()} />);
    tab('시작 설정');
    fireEvent.click(screen.getByRole('button', { name: '+ 스탯 추가' }));
    expect(screen.getByLabelText('시작 설정 1 스탯 1 이름')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '스탯 삭제' }));
    expect(screen.queryByLabelText('시작 설정 1 스탯 1 이름')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '+ 엔딩 추가' }));
    expect(screen.getByLabelText('시작 설정 1 엔딩 1 이름')).toBeTruthy();
    // 엔딩은 조건절 1개를 기본 제공
    expect(screen.getByLabelText('시작 설정 1 엔딩 1 조건 1 스탯')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '엔딩 삭제' }));
    expect(screen.queryByLabelText('시작 설정 1 엔딩 1 이름')).toBeNull();
  });

  it('제출 시 CreateStoryRequest 형태(중첩 startSettings/stats/endings, condition=[{stat,op,value}])로 onSubmit 호출', () => {
    const onSubmit = vi.fn();
    render(<StoryForm submitLabel="저장" onSubmit={onSubmit} />);

    // 프로필
    fill('이름', '용사의 여정');
    fill('한줄소개', '운명을 건 모험');

    // 스토리 설정
    tab('스토리 설정');
    fill('스토리 설정/정보 (세계관·설정·등장인물)', '판타지 세계관');
    fireEvent.click(screen.getByRole('button', { name: '+ 예시 추가' }));
    fill('전개 예시 1 입력', '안녕');
    fill('전개 예시 1 출력', '반갑다');

    // 시작 설정 1
    tab('시작 설정');
    fill('시작 설정 1 이름', '평민 루트');
    fill('시작 설정 1 프롤로그', '한 평민이 있었다');
    fill('시작 설정 1 시작 상황', '마을 광장');
    fireEvent.click(screen.getByRole('button', { name: '+ 답변 추가' }));
    fill('시작 설정 1 추천 답변 1', '둘러본다');

    // 스탯 1
    fireEvent.click(screen.getByRole('button', { name: '+ 스탯 추가' }));
    fill('시작 설정 1 스탯 1 이름', '호감도');
    fill('시작 설정 1 스탯 1 초기값', '10');
    fill('시작 설정 1 스탯 1 최소값', '0');
    fill('시작 설정 1 스탯 1 최대값', '100');

    // 엔딩 1 + 조건
    fireEvent.click(screen.getByRole('button', { name: '+ 엔딩 추가' }));
    fill('시작 설정 1 엔딩 1 이름', '해피엔딩');
    fill('시작 설정 1 엔딩 1 결말', '행복하게 살았다');
    fill('시작 설정 1 엔딩 1 우선순위', '1');
    fill('시작 설정 1 엔딩 1 조건 1 스탯', '호감도');
    fireEvent.change(screen.getByLabelText('시작 설정 1 엔딩 1 조건 1 연산자'), {
      target: { value: '>=' },
    });
    fill('시작 설정 1 엔딩 1 조건 1 값', '80');

    submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as CreateStoryRequest;

    expect(payload).toMatchObject({
      name: '용사의 여정',
      tagline: '운명을 건 모험',
      storyInfo: '판타지 세계관',
      contentRating: 'all',
      visibility: 'private',
      commentsClosed: false,
      shortcuts: [],
    });
    expect(payload.developmentExamples).toEqual([{ input: '안녕', output: '반갑다' }]);

    // 중첩 startSettings 정확
    expect(payload.startSettings).toHaveLength(1);
    const ss = payload.startSettings[0];
    expect(ss).toMatchObject({
      name: '평민 루트',
      prologue: '한 평민이 있었다',
      startSituation: '마을 광장',
    });
    expect(ss.suggestedReplies).toEqual(['둘러본다']);

    // 스탯 직렬화(숫자 변환)
    expect(ss.stats).toEqual([
      { name: '호감도', initialValue: 10, minValue: 0, maxValue: 100 },
    ]);

    // 엔딩 + condition=[{stat,op,value}] 구조
    expect(ss.endings).toHaveLength(1);
    expect(ss.endings[0]).toEqual({
      name: '해피엔딩',
      resultText: '행복하게 살았다',
      priority: 1,
      condition: [{ stat: '호감도', op: '>=', value: 80 }],
    });
  });

  it('다중 시작 설정이 각자 스탯/엔딩을 가진 채 직렬화된다', () => {
    const onSubmit = vi.fn();
    render(<StoryForm submitLabel="저장" onSubmit={onSubmit} />);
    fill('이름', 'S');
    fill('한줄소개', 'T');
    tab('스토리 설정');
    fill('스토리 설정/정보 (세계관·설정·등장인물)', 'I');

    tab('시작 설정');
    fireEvent.click(screen.getByRole('button', { name: '+ 시작 설정 추가' }));

    fill('시작 설정 1 이름', '루트A');
    fill('시작 설정 1 프롤로그', 'pa');
    fill('시작 설정 1 시작 상황', 'sa');
    fill('시작 설정 2 이름', '루트B');
    fill('시작 설정 2 프롤로그', 'pb');
    fill('시작 설정 2 시작 상황', 'sb');

    // 두 번째 시작 설정에만 스탯 추가
    const addStatBtns = screen.getAllByRole('button', { name: '+ 스탯 추가' });
    fireEvent.click(addStatBtns[1]);
    fill('시작 설정 2 스탯 1 이름', '신뢰');

    submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as CreateStoryRequest;
    expect(payload.startSettings).toHaveLength(2);
    expect(payload.startSettings[0].name).toBe('루트A');
    expect(payload.startSettings[0].stats).toEqual([]);
    expect(payload.startSettings[1].name).toBe('루트B');
    expect(payload.startSettings[1].stats).toEqual([
      { name: '신뢰', initialValue: 0, minValue: 0, maxValue: 100 },
    ]);
  });

  it('성인/공개범위 등록 옵션이 payload에 반영된다', () => {
    const onSubmit = vi.fn();
    render(<StoryForm submitLabel="저장" onSubmit={onSubmit} />);
    fill('이름', 'S');
    fill('한줄소개', 'T');
    tab('스토리 설정');
    fill('스토리 설정/정보 (세계관·설정·등장인물)', 'I');
    tab('시작 설정');
    fill('시작 설정 1 이름', 'r');
    fill('시작 설정 1 프롤로그', 'p');
    fill('시작 설정 1 시작 상황', 's');

    tab('등록');
    fireEvent.click(screen.getByRole('radio', { name: '공개' }));

    submit();
    const payload = onSubmit.mock.calls[0][0] as CreateStoryRequest;
    expect(payload.visibility).toBe('public');
  });
});
