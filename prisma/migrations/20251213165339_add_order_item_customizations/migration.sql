-- CreateEnum
CREATE TYPE "PrintMethod" AS ENUM ('DTG', 'SCREEN', 'EMBROIDERY');

-- CreateTable
CREATE TABLE "order_item_customizations" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "designArea" TEXT NOT NULL,
    "designData" JSONB NOT NULL,
    "previewUrl" TEXT,
    "thumbnailUrl" TEXT,
    "productionPublicId" TEXT,
    "productionFileUrl" TEXT,
    "productionDpi" INTEGER NOT NULL DEFAULT 300,
    "productionGenerated" BOOLEAN NOT NULL DEFAULT false,
    "printMethod" "PrintMethod" NOT NULL DEFAULT 'DTG',
    "layerCount" INTEGER NOT NULL DEFAULT 0,
    "hasImages" BOOLEAN NOT NULL DEFAULT false,
    "hasText" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_item_customizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_item_customizations_orderItemId_key" ON "order_item_customizations"("orderItemId");

-- CreateIndex
CREATE INDEX "order_item_customizations_orderItemId_idx" ON "order_item_customizations"("orderItemId");

-- CreateIndex
CREATE INDEX "order_item_customizations_productId_idx" ON "order_item_customizations"("productId");

-- CreateIndex
CREATE INDEX "order_item_customizations_productionGenerated_idx" ON "order_item_customizations"("productionGenerated");

-- AddForeignKey
ALTER TABLE "order_item_customizations" ADD CONSTRAINT "order_item_customizations_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_customizations" ADD CONSTRAINT "order_item_customizations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

