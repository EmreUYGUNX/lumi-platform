-- CreateTable
CREATE TABLE "design_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "productId" TEXT NOT NULL,
    "designArea" TEXT NOT NULL,
    "sessionData" JSONB NOT NULL,
    "previewUrl" TEXT,
    "thumbnailUrl" TEXT,
    "shareToken" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "purgeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "design_sessions_shareToken_key" ON "design_sessions"("shareToken");

-- CreateIndex
CREATE INDEX "design_sessions_userId_idx" ON "design_sessions"("userId");

-- CreateIndex
CREATE INDEX "design_sessions_productId_idx" ON "design_sessions"("productId");

-- CreateIndex
CREATE INDEX "design_sessions_shareToken_idx" ON "design_sessions"("shareToken");

-- CreateIndex
CREATE INDEX "design_sessions_expiresAt_idx" ON "design_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "design_sessions_lastEditedAt_idx" ON "design_sessions"("lastEditedAt");

-- CreateIndex
CREATE INDEX "design_sessions_deletedAt_idx" ON "design_sessions"("deletedAt");

-- CreateIndex
CREATE INDEX "design_sessions_purgeAt_idx" ON "design_sessions"("purgeAt");

-- AddForeignKey
ALTER TABLE "design_sessions" ADD CONSTRAINT "design_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_sessions" ADD CONSTRAINT "design_sessions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

