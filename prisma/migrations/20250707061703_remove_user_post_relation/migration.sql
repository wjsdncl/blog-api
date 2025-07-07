/*
  Warnings:

  - You are about to drop the column `userId` on the `posts` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_userId_fkey";

-- DropIndex
DROP INDEX "posts_userId_idx";

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "userId";
