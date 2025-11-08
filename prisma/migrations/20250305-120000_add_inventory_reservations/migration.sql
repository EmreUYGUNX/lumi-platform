-- CreateEnum
CREATE TYPE "InventoryReservationStatus" AS ENUM ('PENDING', 'ACTIVE', 'RELEASED', 'EXPIRED');

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservationItem" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservationItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InventoryReservation"
ADD CONSTRAINT "InventoryReservation_cartId_fkey"
FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryReservation"
ADD CONSTRAINT "InventoryReservation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryReservationItem"
ADD CONSTRAINT "InventoryReservationItem_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryReservationItem"
ADD CONSTRAINT "InventoryReservationItem_productVariantId_fkey"
FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "InventoryReservation_cartId_idx" ON "InventoryReservation"("cartId");
CREATE INDEX "InventoryReservation_userId_idx" ON "InventoryReservation"("userId");
CREATE INDEX "InventoryReservation_status_idx" ON "InventoryReservation"("status");
CREATE INDEX "InventoryReservationItem_productVariantId_idx" ON "InventoryReservationItem"("productVariantId");
CREATE INDEX "InventoryReservationItem_reservationId_idx" ON "InventoryReservationItem"("reservationId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "InventoryReservationItem_reservationId_productVariantId_key"
ON "InventoryReservationItem"("reservationId", "productVariantId");
