-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN "lineKey" TEXT NOT NULL DEFAULT 'standard';

-- DropIndex
DROP INDEX "CartItem_cartId_productVariantId_key";

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productVariantId_lineKey_key" ON "CartItem"("cartId", "productVariantId", "lineKey");

-- CreateTable
CREATE TABLE "cart_item_customizations" (
    "id" TEXT NOT NULL,
    "cartItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "designArea" TEXT NOT NULL,
    "designData" JSONB NOT NULL,
    "previewUrl" TEXT,
    "thumbnailUrl" TEXT,
    "layerCount" INTEGER NOT NULL DEFAULT 0,
    "hasImages" BOOLEAN NOT NULL DEFAULT false,
    "hasText" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_item_customizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cart_item_customizations_cartItemId_key" ON "cart_item_customizations"("cartItemId");

-- CreateIndex
CREATE INDEX "cart_item_customizations_cartItemId_idx" ON "cart_item_customizations"("cartItemId");

-- CreateIndex
CREATE INDEX "cart_item_customizations_productId_idx" ON "cart_item_customizations"("productId");

-- AddForeignKey
ALTER TABLE "cart_item_customizations" ADD CONSTRAINT "cart_item_customizations_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "CartItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item_customizations" ADD CONSTRAINT "cart_item_customizations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

