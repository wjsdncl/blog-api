/*
  Warnings:

  - You are about to drop the column `isActive` on the `tech_stacks` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "tech_stacks_isActive_idx";

-- AlterTable
ALTER TABLE "tech_stacks" DROP COLUMN "isActive";
