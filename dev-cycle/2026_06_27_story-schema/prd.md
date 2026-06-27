# #43 스토리 스키마 토대 — Story/StartSetting/Stat/Ending/StorySession

## 목적 / Why
크랙 스토리 모드(인터랙티브 픽션) MVP의 데이터 토대. #44/#45/#49 전부의 하드 선행.
l_2026_06_19 교훈(토대 분할 시 후속 컬럼 제약 미예견) 적용 — 후속이 요구할 제약을 토대에서 선반영.

## 요구사항

### Must
- Prisma 모델 5개 신규: `Story`, `StartSetting`, `Stat`, `Ending`, `StorySession`
- **Story**: profileImage(String?), name, tagline, promptTemplateId(String?), storyInfo(String), developmentExamples(Json), shortcuts(Json), contentRating(String @default("all")), visibility(String @default("private")), commentsClosed(Boolean @default(false)), ownerContext(userId? + browserId? + User relation), timestamps
- **StartSetting** (Story 자식 N): storyId, name, prologue, startSituation, playGuide(String?), suggestedReplies(Json), createdAt
- **Stat** (StartSetting 자식 ≤7, **정규화 테이블**): startSettingId, name, initialValue(Int), minValue(Int), maxValue(Int)
- **Ending** (StartSetting 자식 ≤10): startSettingId, name, condition(Json — `[{stat,op,value}]` AND 규칙), resultText, priority(Int @default(0))
- **StorySession** (런타임): storyId, startSettingId, ownerContext(userId? + browserId?), statValues(Json — 런타임 가변), endedWith(String? — Ending id), timestamps
- ownerContext = Character의 `userId String?` + `browserId String?` + `user User? @relation` 이중축 **그대로 복제**(신규 패턴 발명 금지)
- User 모델에 역방향 relation 추가(stories, storySessions)
- 마이그레이션 생성 + dev DB 적용(`migrate diff`→폴더 수작업→`migrate deploy` 패턴, 비인터랙티브)
- `prisma generate`로 client 재생성 → 전체 컴파일 GREEN

### Nice-to-have
- shared 타입(`Story`/`StartSetting`/`Stat`/`Ending` 인터페이스) 선반영 — #44/#45가 바로 소비

## 잠긴 결정 (sprint-pm Phase 5 break)
- Stat = 정규화 테이블 / Ending.condition = Json / StorySession.statValues = Json / developmentExamples·suggestedReplies·shortcuts = Json

## Micro 가정 (확인 요청 — 틀리면 지금 정정)
1. **Story.id** = 서버 생성 `cuid()` (Character와 달리 localStorage 레거시 없음 → 클라 제공 불필요)
2. **Cascade**: Story 삭제 → StartSetting → Stat/Ending cascade. Story 삭제 → StorySession cascade. (`onDelete: Cascade`)
3. **Stat 유니크**: `@@unique([startSettingId, name])` (한 시작설정 내 스탯명 중복 금지)
4. **condition op 허용값**: `>=`, `<=`, `==`, `>`, `<` (런타임 #51이 평가, 스키마는 Json이라 비강제 — 값 검증은 #44 DTO/#51 엔진)
5. **visibility 기본** = `private`(크랙 기본 비공개), contentRating 기본 = `all`

## 성공 기준 (검증 가능)
- [ ] `apps/api/prisma/schema.prisma`에 Story/StartSetting/Stat/Ending/StorySession 5모델 존재, 필드가 위 Must 명세와 일치
- [ ] ownerContext가 Character 패턴과 동일(userId String? + browserId String? + user relation + @@index([userId]),([browserId]))
- [ ] Stat이 정규화 테이블(컬럼 name/initialValue/minValue/maxValue), Ending.condition·StorySession.statValues·developmentExamples·suggestedReplies·shortcuts가 Json 타입
- [ ] 관계: Story 1-N StartSetting, StartSetting 1-N Stat·Ending, Story 1-N StorySession, User 1-N Story·StorySession. cascade 명시
- [ ] 신규 마이그레이션 폴더 1개 생성, `prisma migrate status` = up to date (dev DB 적용)
- [ ] `prisma generate` 성공 + `pnpm --filter api build`(tsc) GREEN, 기존 api 테스트 회귀 없음(전부 PASS 유지)
- [ ] (nice) shared에 Story 계열 인터페이스 export, `pnpm --filter shared build` GREEN
