/*
  Warnings:

  - You are about to drop the `_ProjectToTechStack` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ProjectToTechStack" DROP CONSTRAINT "_ProjectToTechStack_A_fkey";

-- DropForeignKey
ALTER TABLE "_ProjectToTechStack" DROP CONSTRAINT "_ProjectToTechStack_B_fkey";

-- DropTable
DROP TABLE "_ProjectToTechStack";

-- CreateTable
CREATE TABLE "_ProjectTechStack" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ProjectTechStack_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ProjectTechStack_B_index" ON "_ProjectTechStack"("B");

-- AddForeignKey
ALTER TABLE "_ProjectTechStack" ADD CONSTRAINT "_ProjectTechStack_A_fkey" FOREIGN KEY ("A") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectTechStack" ADD CONSTRAINT "_ProjectTechStack_B_fkey" FOREIGN KEY ("B") REFERENCES "tech_stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
