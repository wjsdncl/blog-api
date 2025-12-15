/*
  Warnings:

  - The primary key for the `comment_likes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `likes` on the `comments` table. All the data in the column will be lost.
  - The primary key for the `post_likes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `category` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `coverImg` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `isPublished` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `likes` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `publishedAt` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `isAdmin` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastLoginAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `projects` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[commentId,userId]` on the table `comment_likes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[postId,userId]` on the table `post_likes` will be added. If there are existing duplicate values, this will fail.
  - Made the column `userId` on table `comments` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_userId_fkey";

-- DropIndex
DROP INDEX "comments_createdAt_idx";

-- DropIndex
DROP INDEX "posts_category_isPublished_idx";

-- DropIndex
DROP INDEX "posts_createdAt_category_idx";

-- DropIndex
DROP INDEX "posts_isPublished_publishedAt_idx";

-- DropIndex
DROP INDEX "posts_tags_idx";

-- DropIndex
DROP INDEX "posts_userId_isPrivate_idx";

-- DropIndex
DROP INDEX "users_isActive_idx";

-- DropIndex
DROP INDEX "users_isAdmin_idx";

-- AlterTable
ALTER TABLE "comment_likes" DROP CONSTRAINT "comment_likes_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "comments" DROP COLUMN "likes",
ADD COLUMN     "depth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "likesCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "post_likes" DROP CONSTRAINT "post_likes_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "category",
DROP COLUMN "coverImg",
DROP COLUMN "isPublished",
DROP COLUMN "likes",
DROP COLUMN "publishedAt",
DROP COLUMN "tags",
ADD COLUMN     "categoryId" INTEGER,
ADD COLUMN     "likesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "thumbnail" VARCHAR(500);

-- AlterTable
ALTER TABLE "users" DROP COLUMN "isActive",
DROP COLUMN "isAdmin",
DROP COLUMN "lastLoginAt",
ADD COLUMN     "isOwner" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "projects";

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PostToTag" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PostToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tags_slug_idx" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "_PostToTag_B_index" ON "_PostToTag"("B");

-- CreateIndex
CREATE UNIQUE INDEX "comment_likes_commentId_userId_key" ON "comment_likes"("commentId", "userId");

-- CreateIndex
CREATE INDEX "comments_depth_idx" ON "comments"("depth");

-- CreateIndex
CREATE INDEX "comments_postId_parentCommentId_idx" ON "comments"("postId", "parentCommentId");

-- CreateIndex
CREATE INDEX "comments_likesCount_idx" ON "comments"("likesCount");

-- CreateIndex
CREATE INDEX "comments_postId_isDeleted_createdAt_idx" ON "comments"("postId", "isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "comments_parentCommentId_depth_createdAt_idx" ON "comments"("parentCommentId", "depth", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "post_likes_postId_userId_key" ON "post_likes"("postId", "userId");

-- CreateIndex
CREATE INDEX "posts_createdAt_categoryId_idx" ON "posts"("createdAt", "categoryId");

-- CreateIndex
CREATE INDEX "posts_userId_idx" ON "posts"("userId");

-- CreateIndex
CREATE INDEX "posts_likesCount_idx" ON "posts"("likesCount");

-- CreateIndex
CREATE INDEX "users_isOwner_idx" ON "users"("isOwner");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PostToTag" ADD CONSTRAINT "_PostToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PostToTag" ADD CONSTRAINT "_PostToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
