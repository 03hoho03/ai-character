-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "browserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "personality" TEXT NOT NULL,
    "speechStyle" TEXT NOT NULL,
    "worldview" TEXT NOT NULL,
    "greeting" TEXT NOT NULL,
    "exampleDialogue" JSONB NOT NULL,
    "prohibitions" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Character_browserId_idx" ON "Character"("browserId");

-- CreateIndex
CREATE INDEX "Character_isPublic_updatedAt_idx" ON "Character"("isPublic", "updatedAt");
