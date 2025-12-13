-- CreateTable
CREATE TABLE "customer_designs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "purgeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_designs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_designs_publicId_key" ON "customer_designs"("publicId");

-- CreateIndex
CREATE INDEX "customer_designs_userId_idx" ON "customer_designs"("userId");

-- CreateIndex
CREATE INDEX "customer_designs_isPublic_idx" ON "customer_designs"("isPublic");

-- CreateIndex
CREATE INDEX "customer_designs_usageCount_idx" ON "customer_designs"("usageCount");

-- CreateIndex
CREATE INDEX "customer_designs_deletedAt_idx" ON "customer_designs"("deletedAt");

-- CreateIndex
CREATE INDEX "customer_designs_purgeAt_idx" ON "customer_designs"("purgeAt");

-- CreateIndex
CREATE INDEX "customer_designs_tags_idx" ON "customer_designs" USING GIN ("tags");

-- AddForeignKey
ALTER TABLE "customer_designs" ADD CONSTRAINT "customer_designs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
