-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "contentRating" TEXT NOT NULL DEFAULT 'all';

-- CreateIndex
CREATE INDEX "Character_isPublic_contentRating_idx" ON "Character"("isPublic", "contentRating");
