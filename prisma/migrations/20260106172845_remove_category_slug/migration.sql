/*
  Warnings:

  - You are about to drop the column `access_token` on the `auth` table. All the data in the column will be lost.
  - You are about to drop the column `password_hash` on the `auth` table. All the data in the column will be lost.
  - You are about to drop the column `refresh_token` on the `auth` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `categories` table. All the data in the column will be lost.
  - Made the column `provider` on table `auth` required. This step will fail if there are existing NULL values in that column.
  - Made the column `provider_id` on table `auth` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "categories_slug_idx";

-- DropIndex
DROP INDEX "categories_slug_key";

-- AlterTable
ALTER TABLE "auth"."auth" DROP COLUMN "access_token",
DROP COLUMN "password_hash",
DROP COLUMN "refresh_token",
ALTER COLUMN "provider" SET NOT NULL,
ALTER COLUMN "provider_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "slug",
ADD COLUMN     "post_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "comment_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "like_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tags" ADD COLUMN     "post_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "categories_post_count_idx" ON "categories"("post_count");

-- CreateIndex
CREATE INDEX "posts_like_count_idx" ON "posts"("like_count");

-- CreateIndex
CREATE INDEX "posts_comment_count_idx" ON "posts"("comment_count");

-- CreateIndex
CREATE INDEX "tags_post_count_idx" ON "tags"("post_count");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");
