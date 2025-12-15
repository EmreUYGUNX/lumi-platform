-- CreateTable
CREATE TABLE "design_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "thumbnailUrl" TEXT,
    "previewUrl" TEXT,
    "canvasData" JSONB NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "design_templates_category_idx" ON "design_templates"("category");

-- CreateIndex
CREATE INDEX "design_templates_tags_idx" ON "design_templates" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "design_templates_isPaid_idx" ON "design_templates"("isPaid");

-- CreateIndex
CREATE INDEX "design_templates_usageCount_idx" ON "design_templates"("usageCount");

-- CreateIndex
CREATE INDEX "design_templates_isPublished_idx" ON "design_templates"("isPublished");

-- CreateIndex
CREATE INDEX "design_templates_isFeatured_idx" ON "design_templates"("isFeatured");

-- CreateIndex
CREATE INDEX "design_templates_deletedAt_idx" ON "design_templates"("deletedAt");

-- CreateIndex
CREATE INDEX "design_templates_createdAt_idx" ON "design_templates"("createdAt");

-- CreateTable
CREATE TABLE "clipart_assets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "svg" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clipart_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clipart_assets_category_idx" ON "clipart_assets"("category");

-- CreateIndex
CREATE INDEX "clipart_assets_tags_idx" ON "clipart_assets" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "clipart_assets_isPaid_idx" ON "clipart_assets"("isPaid");

-- CreateIndex
CREATE INDEX "clipart_assets_usageCount_idx" ON "clipart_assets"("usageCount");

-- CreateIndex
CREATE INDEX "clipart_assets_deletedAt_idx" ON "clipart_assets"("deletedAt");

-- CreateIndex
CREATE INDEX "clipart_assets_createdAt_idx" ON "clipart_assets"("createdAt");

