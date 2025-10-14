-- Add unique constraint to enforce single review per user per product
CREATE UNIQUE INDEX "Review_productId_userId_key" ON "Review"("productId", "userId");
