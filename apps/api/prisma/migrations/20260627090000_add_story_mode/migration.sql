-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "profileImage" TEXT,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "promptTemplateId" TEXT,
    "storyInfo" TEXT NOT NULL,
    "developmentExamples" JSONB NOT NULL,
    "shortcuts" JSONB NOT NULL,
    "contentRating" TEXT NOT NULL DEFAULT 'all',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "commentsClosed" BOOLEAN NOT NULL DEFAULT false,
    "browserId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StartSetting" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prologue" TEXT NOT NULL,
    "startSituation" TEXT NOT NULL,
    "playGuide" TEXT,
    "suggestedReplies" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StartSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stat" (
    "id" TEXT NOT NULL,
    "startSettingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initialValue" INTEGER NOT NULL,
    "minValue" INTEGER NOT NULL,
    "maxValue" INTEGER NOT NULL,

    CONSTRAINT "Stat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ending" (
    "id" TEXT NOT NULL,
    "startSettingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "resultText" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Ending_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorySession" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "startSettingId" TEXT NOT NULL,
    "statValues" JSONB NOT NULL,
    "endedWith" TEXT,
    "browserId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Story_browserId_idx" ON "Story"("browserId");

-- CreateIndex
CREATE INDEX "Story_userId_idx" ON "Story"("userId");

-- CreateIndex
CREATE INDEX "Story_visibility_updatedAt_idx" ON "Story"("visibility", "updatedAt");

-- CreateIndex
CREATE INDEX "StartSetting_storyId_idx" ON "StartSetting"("storyId");

-- CreateIndex
CREATE INDEX "Stat_startSettingId_idx" ON "Stat"("startSettingId");

-- CreateIndex
CREATE UNIQUE INDEX "Stat_startSettingId_name_key" ON "Stat"("startSettingId", "name");

-- CreateIndex
CREATE INDEX "Ending_startSettingId_idx" ON "Ending"("startSettingId");

-- CreateIndex
CREATE INDEX "StorySession_browserId_idx" ON "StorySession"("browserId");

-- CreateIndex
CREATE INDEX "StorySession_userId_idx" ON "StorySession"("userId");

-- CreateIndex
CREATE INDEX "StorySession_storyId_idx" ON "StorySession"("storyId");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartSetting" ADD CONSTRAINT "StartSetting_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stat" ADD CONSTRAINT "Stat_startSettingId_fkey" FOREIGN KEY ("startSettingId") REFERENCES "StartSetting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ending" ADD CONSTRAINT "Ending_startSettingId_fkey" FOREIGN KEY ("startSettingId") REFERENCES "StartSetting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorySession" ADD CONSTRAINT "StorySession_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorySession" ADD CONSTRAINT "StorySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

