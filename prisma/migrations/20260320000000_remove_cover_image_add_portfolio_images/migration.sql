-- CreateTable
CREATE TABLE "public"."portfolio_images" (
    "id" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_images_portfolio_id_order_idx" ON "public"."portfolio_images"("portfolio_id", "order");

-- AddForeignKey
ALTER TABLE "public"."portfolio_images" ADD CONSTRAINT "portfolio_images_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: migrate existing cover_image data to portfolio_images
INSERT INTO "public"."portfolio_images" ("id", "portfolio_id", "url", "order", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", "cover_image", 0, NOW(), NOW()
FROM "public"."portfolios"
WHERE "cover_image" IS NOT NULL;

-- AlterTable
ALTER TABLE "public"."portfolios" DROP COLUMN "cover_image";
