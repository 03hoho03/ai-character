-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "category" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Character_isPublic_category_idx" ON "Character"("isPublic", "category");

-- CreateIndex
CREATE INDEX "Character_tags_idx" ON "Character" USING GIN ("tags");
