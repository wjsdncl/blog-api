import { PrismaClient } from "@prisma/client";
import { USER, COMMENT, POST } from "./mock.js";

const prisma = new PrismaClient();

async function main() {
  // 기존 데이터 삭제
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();

  // 목 데이터 삽입
  await prisma.user.createMany({
    data: USER,
    skipDuplicates: true,
  });

  await prisma.post.createMany({
    data: POST,
    skipDuplicates: true,
  });

  await prisma.comment.createMany({
    data: COMMENT,
    skipDuplicates: true,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
