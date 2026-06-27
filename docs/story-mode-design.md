# 스토리 모드 설계 (인터랙티브 픽션) — 크랙 벤치마크

> 출처: 크랙 "작품 만들기 → 스토리" 8탭 벤치마크 (2026-06-27).
> 현재 앱은 `Persona`(=크랙 "캐릭터") 단일 모델만 보유. 스토리 모드는 **별도 엔티티 그래프**다.
> 스코프 합의: **풀 인터랙티브 픽션**. 1차 출시(MVP) 경계는 §5 참고.

## 1. 핵심 통찰

- 중심축은 **시작 설정(StartSetting)** 이다. 스탯·엔딩·미디어·키워드북이 전부 *시작 설정별로* 스코프된다.
- 한 Story 안에 여러 StartSetting(분기 시나리오)이 있고, 플레이어는 그중 하나를 골라 세션을 시작한다.
- **신뢰 경계(CLAUDE.md #23 준수)**: 클라는 `storyId/startSettingId/sessionId/message`만 보낸다. 서버가 Story DB에서 system instruction을 재조립(`buildStoryPrompt`) — 기존 `buildPersonaPrompt` 패턴의 확장. 클라가 보낸 instruction류는 ValidationPipe whitelist가 strip.

## 2. 탭 → 필드 통합 스펙

| 탭 | 필드 | 다중성 | 비고 |
|---|---|---|---|
| 프로필* | 대표이미지(1080×1620)·이름(2~30)·한줄소개(≤30) | 1 | AI 랜덤생성 |
| 스토리 설정* | 프롬프트 템플릿 선택 · 스토리 설정/정보(≤5000) · 전개예시(in/out) | 예시 ≤3 | 자동생성 |
| 시작 설정* | 프롤로그(≤1000)·이름(≤12)·시작상황(≤1000)·플레이가이드(≤500, AI 비기억)·추천답변 | 설정 N개, 답변 ≤3 | **분기 단위** |
| 스탯 설정 | 스탯(이름/초기값/범위) | 시작설정별 ≤7 | 호감도류 변수 |
| 미디어 | 분류×상황 이미지 매트릭스(`분류_상황.jpg`) | ≤1600장 | AI가 상황 매칭 자동표시 |
| 키워드북 | 키워드 노트(트리거 키워드 ↔ 주입 텍스트) | N | lorebook = 조건부 주입 |
| 단축어 | 자주쓰는 명령 | ≤20 | story-level |
| 엔딩 설정 | 엔딩(조건+결말) | 시작설정별 ≤10 | "먼저 조건 도달한 1개만" 제공 |
| 등록* | 이용자층(불변)·공개범위(공개/비공개/링크)·댓글닫기 | 1 | |

## 3. 데이터 모델 (Prisma 초안)

```
Story
 ├─ profile (image, name, tagline)
 ├─ promptTemplateId, storyInfo(5000), developmentExamples Json[]  // {input, output} ≤3
 ├─ rating(minor_ok|adult, 불변), visibility(public|private|link), commentsClosed
 ├─ ownerContext (userId | browserId)   // 기존 OwnerContext 패턴 재사용
 ├─ shortcuts Json[]  (≤20)             // story-level
 └─ StartSetting[] (N)                  // ★ 중심축
       ├─ prologue, name, startSituation, playGuide, suggestedReplies Json[] (≤3)
       ├─ Stat[]        (≤7)   { name, initialValue, min, max }
       ├─ Ending[]      (≤10)  { name, condition Json, resultText }   // condition = 스탯 임계값 규칙
       ├─ KeywordNote[] (N)    { keywords[], injectText, scope }      // [후속]
       └─ MediaImage[]  (N)    { category, situation, url, scope }    // [후속]

StorySession  (플레이 런타임 — Conversation의 스토리판)
 ├─ storyId, startSettingId, ownerContext
 ├─ statValues Json            // 현재 스탯 상태 (런타임 가변)
 ├─ messages[]
 └─ endedWith (Ending id | null)
```

## 4. 런타임 엔진

### 4.1 매 턴 system instruction 재조립 (`buildStoryPrompt`)
```
[프롬프트 템플릿]
+ [스토리 설정/정보]  + [시작 상황]
+ [전개 예시 few-shot]
+ [현재 스탯 상태 주입: "호감도 35/100, 신뢰 12/100 ..."]
+ [키워드북 매칭 노트]                  // [후속] 최근 메시지·유저입력 스캔
+ [스탯 delta 출력 지시]                // §4.2
```

### 4.2 스탯 갱신 — **모델 delta 출력** (결정)
- 모델이 답변과 함께 구조화된 스탯 변화량을 출력한다. **Gemini structured output**(responseSchema)로 강제.
- 예: `{ "reply": "...", "statDeltas": { "호감도": +5, "신뢰": -2 } }`
- 서버가 파싱→`statValues`에 clamp(min/max) 적용. 모델이 임의 스탯명 못 만들게 **정의된 스탯 키로만 화이트리스트**.
- 신뢰 경계: statDeltas는 *서버가 검증*한 뒤 적용. 모델 출력을 무검증 신뢰 금지.

### 4.3 엔딩 판정 — **스탯 임계값 규칙** (결정)
- `Ending.condition` = 구조화 규칙 (예: `[{stat:"호감도", op:">=", value:80}]`, AND 결합).
- 매 턴 스탯 갱신 *후* 서버가 결정론적으로 평가. **먼저 충족된 엔딩 1개**만 트리거(크랙 사양). 동시 충족 시 정렬 우선순위.
- 트리거 시 `resultText` 표시 + `StorySession.endedWith` 기록 + 세션 종료.

### 4.4 미디어 매칭 [후속]
- 모델이 상황 태그(예: `기쁨`) 출력 → 서버가 `분류_상황` 파일명 규칙으로 이미지 조회·표시.

## 5. 출시 단계 (풀 스코프 유지, 단계 출시)

- **MVP (1차)**: 프로필 + 스토리 설정 + 시작 설정 + **스탯** + **엔딩** + 플레이 런타임(delta·임계값 엔진) + 등록(공개범위).
  → 제작→플레이→스탯 변화→엔딩 달성의 **핵심 루프 완결**.
- **2차**: 키워드북(lorebook 조건부 주입).
- **3차**: 미디어(분류×상황 이미지 자동표시) — 이미지 생성 API(#20·#39 연계) 의존.
- **4차**: 단축어, 다중 시작설정 분기 UX 고도화, AI 자동생성 버튼(프롤로그/스토리정보/전개예시).

## 6. 결정 로그

| 항목 | 결정 | 대안 |
|---|---|---|
| 스탯 갱신 | 모델 structured delta 출력 | 별도 평가 패스 / 규칙 기반 |
| 엔딩 조건 | 스탯 임계값 규칙(결정론적) | 자연어+LLM 판정 |
| MVP 경계 | 스토리+시작설정+스탯+엔딩 | +키워드북 / +미디어 |
| 신뢰 경계 | 서버 재조립 + delta 서버검증 | (CLAUDE.md #23 준수) |
</content>
</invoke>
