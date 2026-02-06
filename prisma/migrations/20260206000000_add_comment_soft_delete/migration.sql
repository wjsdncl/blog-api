-- AlterTable
ALTER TABLE "public"."comments" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- DropIndex
DROP INDEX "public"."comments_post_id_created_at_idx";

-- CreateIndex
CREATE INDEX "comments_post_id_deleted_at_created_at_idx" ON "public"."comments"("post_id", "deleted_at", "created_at");
