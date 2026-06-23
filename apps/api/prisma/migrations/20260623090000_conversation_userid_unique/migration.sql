-- #34 대화 유니크키 전환 (browserId,personaId) 축 유지 + (userId,personaId) 축 추가.
-- userId nullable이라 Postgres가 NULL을 distinct 처리 → userId unique는 로그인 row에만 자연 partial 집행.
-- 순서: dedupe(중복 (userId,personaId) 정리) → browserId nullable화 → unique index 생성.
-- dedupe가 먼저 와야 unique violation 없이 적용됨(클레임 #33이 다기기 로그인 시 같은 personaId 중복을 만들 수 있음).

-- #34-dedupe-start
-- (userId,personaId) 중복 그룹에서 최신 1건만 유지: updatedAt desc → 메시지 많은 → id desc.
-- 나머지 Conversation 삭제(Message는 onDelete:Cascade로 함께 삭제). userId IS NULL(비로그인)은 대상 아님.
DELETE FROM "Conversation" c
USING (
  SELECT conv.id,
         ROW_NUMBER() OVER (
           PARTITION BY conv."userId", conv."personaId"
           ORDER BY conv."updatedAt" DESC, conv.msg_count DESC, conv.id DESC
         ) AS rn
  FROM (
    SELECT cc.id, cc."userId", cc."personaId", cc."updatedAt",
           (SELECT count(*) FROM "Message" m WHERE m."conversationId" = cc.id) AS msg_count
    FROM "Conversation" cc
    WHERE cc."userId" IS NOT NULL
  ) conv
) ranked
WHERE c.id = ranked.id AND ranked.rn > 1;
-- #34-dedupe-end

-- AlterTable
ALTER TABLE "Conversation" ALTER COLUMN "browserId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_userId_personaId_key" ON "Conversation"("userId", "personaId");
