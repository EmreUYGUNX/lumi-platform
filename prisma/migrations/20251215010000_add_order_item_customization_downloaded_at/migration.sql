-- AlterTable
ALTER TABLE "order_item_customizations" ADD COLUMN "downloadedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "order_item_customizations_downloadedAt_idx" ON "order_item_customizations"("downloadedAt");

