-- AlterTable
ALTER TABLE "product_customizations" ADD COLUMN "restrictedWords" TEXT[] DEFAULT ARRAY[]::TEXT[];

