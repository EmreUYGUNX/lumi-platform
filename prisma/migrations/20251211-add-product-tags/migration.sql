-- Add tags column to Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add GIN index for tags array search
CREATE INDEX IF NOT EXISTS "Product_tags_idx" ON "Product" USING GIN ("tags");
