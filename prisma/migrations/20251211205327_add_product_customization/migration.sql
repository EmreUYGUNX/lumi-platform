-- CreateTable
CREATE TABLE "product_customizations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "designAreas" JSONB NOT NULL,
    "maxLayers" INTEGER NOT NULL DEFAULT 10,
    "allowImages" BOOLEAN NOT NULL DEFAULT true,
    "allowText" BOOLEAN NOT NULL DEFAULT true,
    "allowShapes" BOOLEAN NOT NULL DEFAULT false,
    "allowDrawing" BOOLEAN NOT NULL DEFAULT false,
    "minImageSize" INTEGER,
    "maxImageSize" INTEGER,
    "allowedFonts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "basePriceModifier" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pricePerLayer" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_customizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_customizations_productId_key" ON "product_customizations"("productId");

-- AddForeignKey
ALTER TABLE "product_customizations" ADD CONSTRAINT "product_customizations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
