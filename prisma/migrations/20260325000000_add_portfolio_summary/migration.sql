-- AlterTable
ALTER TABLE "public"."portfolios" ADD COLUMN "summary" TEXT[] DEFAULT ARRAY[]::TEXT[];
