# #49 [46a] 플레이 세션 영속 (StorySession 생성/이어하기)

## 목적 / Why
스토리 모드 플레이 런타임의 토대 — 플레이어가 StartSetting을 골라 세션을 시작하면
해당 시작설정의 Stat[]을 읽어 statValues를 초기값으로 세팅하고 세션을 영속한다.
이어하기(GET)로 진행 중 세션의 현재 상태를 복원한다. (delta·엔딩·모델 호출은 후속 #50/#51 범위 밖)

## 요구사항
### Must
- POST /story-sessions — { storyId, startSettingId, browserId? }로 세션 생성.
  - 해당 StartSetting의 Stat[]을 읽어 **statValues를 Stat.initialValue로 초기화** ({name: initialValue}).
  - OwnerContext(쿠키 userId ?? browserId)로 소유 기록(ownerWhere).
  - 생성 세션 반환(statValues 포함, endedWith=null).
- GET /story-sessions/:id — 이어하기. 소유자 검증 후 세션(statValues/endedWith) 반환. 소유 불일치/부재 404.
- DTO 거부: storyId/startSettingId 누락 → 400.
- 신뢰경계(#23): body userId 위조 무시 — 쿠키만 신뢰.
- shared에 StorySessionRecord / CreateStorySessionRequest 타입 추가.
- StorySessionsModule을 app.module.ts에 등록.

### Nice-to-have
- (선택) GET /story-sessions?storyId=&startSettingId= get-or-resume — 범위 과하면 생략.

## 비범위 (구현 금지)
- delta 적용(#50) · 엔딩 평가(#51) · 실제 Gemini 호출 · 메시지 추가 런타임.

## 성공 기준 (검증 가능)
- [ ] POST /story-sessions 201 + statValues가 StartSetting.stats의 initialValue로 정확히 매핑됨 ({호감도:0, 신뢰:10})
- [ ] POST DTO 거부: storyId 누락 400, startSettingId 누락 400
- [ ] GET /story-sessions/:id 소유자 200 + statValues/endedWith 반환
- [ ] GET /story-sessions/:id 타 소유 404 (존재 비노출)
- [ ] body userId 위조해도 browserId 소유로 동작
- [ ] 라우트 순서: 리터럴 vs :id 공존 시 회귀 없음 (해당되면)
- [ ] pnpm --filter api test 전체 GREEN, typecheck clean
- [ ] delta/엔딩 평가/모델 호출 코드 부재 (범위 누수 0)
