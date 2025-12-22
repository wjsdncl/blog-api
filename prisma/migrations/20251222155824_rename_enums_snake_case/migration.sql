/*
  Warnings:

  - You are about to drop the column `deleted_at` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `is_deleted` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `post_count` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `comments` table. All the data in the column will be lost.
  - You are about to drop the column `is_deleted` on the `comments` table. All the data in the column will be lost.
  - You are about to drop the column `like_count` on the `comments` table. All the data in the column will be lost.
  - You are about to drop the column `author_id` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `comment_count` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `featured` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `is_deleted` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `like_count` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `published` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `tags` table. All the data in the column will be lost.
  - You are about to drop the column `is_deleted` on the `tags` table. All the data in the column will be lost.
  - You are about to drop the column `post_count` on the `tags` table. All the data in the column will be lost.
  - The `role` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `auth` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auth";

-- CreateEnum
CREATE TYPE "publish_status" AS ENUM ('DRAFT', 'PUBLISHED', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "role" AS ENUM ('USER', 'OWNER');

-- DropForeignKey
ALTER TABLE "auth" DROP CONSTRAINT "auth_user_id_fkey";

-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_author_id_fkey";

-- DropIndex
DROP INDEX "categories_is_deleted_idx";

-- DropIndex
DROP INDEX "categories_is_deleted_order_idx";

-- DropIndex
DROP INDEX "comments_author_id_is_deleted_idx";

-- DropIndex
DROP INDEX "comments_is_deleted_idx";

-- DropIndex
DROP INDEX "comments_post_id_is_deleted_created_at_idx";

-- DropIndex
DROP INDEX "posts_author_id_idx";

-- DropIndex
DROP INDEX "posts_author_id_published_idx";

-- DropIndex
DROP INDEX "posts_category_id_published_idx";

-- DropIndex
DROP INDEX "posts_is_deleted_idx";

-- DropIndex
DROP INDEX "posts_is_deleted_published_idx";

-- DropIndex
DROP INDEX "posts_published_created_at_idx";

-- DropIndex
DROP INDEX "posts_published_featured_created_at_idx";

-- DropIndex
DROP INDEX "tags_is_deleted_idx";

-- DropIndex
DROP INDEX "tags_is_deleted_post_count_idx";

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "deleted_at",
DROP COLUMN "is_deleted",
DROP COLUMN "post_count";

-- AlterTable
ALTER TABLE "comments" DROP COLUMN "deleted_at",
DROP COLUMN "is_deleted",
DROP COLUMN "like_count";

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "author_id",
DROP COLUMN "comment_count",
DROP COLUMN "deleted_at",
DROP COLUMN "featured",
DROP COLUMN "is_deleted",
DROP COLUMN "like_count",
DROP COLUMN "published",
ADD COLUMN     "status" "publish_status" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "tags" DROP COLUMN "deleted_at",
DROP COLUMN "is_deleted",
DROP COLUMN "post_count";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "role" "role" NOT NULL DEFAULT 'USER';

-- DropTable
DROP TABLE "auth";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "auth"."auth" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "password_hash" TEXT,
    "provider" TEXT,
    "provider_id" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "status" "publish_status" NOT NULL DEFAULT 'DRAFT',
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "category_id" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_links" (
    "id" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tech_stacks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tech_stacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PortfolioToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PortfolioToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PortfolioToTechStack" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PortfolioToTechStack_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_user_id_key" ON "auth"."auth"("user_id");

-- CreateIndex
CREATE INDEX "auth_user_id_idx" ON "auth"."auth"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_provider_provider_id_key" ON "auth"."auth"("provider", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "portfolios_slug_key" ON "portfolios"("slug");

-- CreateIndex
CREATE INDEX "portfolios_category_id_idx" ON "portfolios"("category_id");

-- CreateIndex
CREATE INDEX "portfolios_slug_idx" ON "portfolios"("slug");

-- CreateIndex
CREATE INDEX "portfolios_status_order_idx" ON "portfolios"("status", "order");

-- CreateIndex
CREATE INDEX "portfolio_links_portfolio_id_order_idx" ON "portfolio_links"("portfolio_id", "order");

-- CreateIndex
CREATE INDEX "portfolio_links_type_idx" ON "portfolio_links"("type");

-- CreateIndex
CREATE UNIQUE INDEX "tech_stacks_name_key" ON "tech_stacks"("name");

-- CreateIndex
CREATE INDEX "tech_stacks_name_idx" ON "tech_stacks"("name");

-- CreateIndex
CREATE INDEX "tech_stacks_category_idx" ON "tech_stacks"("category");

-- CreateIndex
CREATE INDEX "_PortfolioToTag_B_index" ON "_PortfolioToTag"("B");

-- CreateIndex
CREATE INDEX "_PortfolioToTechStack_B_index" ON "_PortfolioToTechStack"("B");

-- CreateIndex
CREATE INDEX "comments_post_id_created_at_idx" ON "comments"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_author_id_created_at_idx" ON "comments"("author_id", "created_at");

-- CreateIndex
CREATE INDEX "posts_status_created_at_idx" ON "posts"("status", "created_at");

-- CreateIndex
CREATE INDEX "posts_category_id_status_idx" ON "posts"("category_id", "status");

-- AddForeignKey
ALTER TABLE "auth"."auth" ADD CONSTRAINT "auth_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_links" ADD CONSTRAINT "portfolio_links_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PortfolioToTag" ADD CONSTRAINT "_PortfolioToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PortfolioToTag" ADD CONSTRAINT "_PortfolioToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PortfolioToTechStack" ADD CONSTRAINT "_PortfolioToTechStack_A_fkey" FOREIGN KEY ("A") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PortfolioToTechStack" ADD CONSTRAINT "_PortfolioToTechStack_B_fkey" FOREIGN KEY ("B") REFERENCES "tech_stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
