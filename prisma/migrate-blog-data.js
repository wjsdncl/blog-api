import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// .dat 파일을 읽고 파싱하는 함수
function parseDatFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");

  return lines.map((line) => {
    // PostgreSQL 탭 구분 형식 파싱
    const columns = line.split("\t");
    return columns.map((col) => {
      if (col === "\\N") return null; // PostgreSQL NULL 값
      if (col === "t") return true; // PostgreSQL boolean true
      if (col === "f") return false; // PostgreSQL boolean false
      return col;
    });
  });
}

// 태그 문자열 파싱 함수 (예: "{React,Next.js,TypeScript}" → ["React", "Next.js", "TypeScript"])
function parseTags(tagsString) {
  if (!tagsString || tagsString === "\\N") return [];

  // 중괄호 제거하고 쉼표로 분리
  const cleaned = tagsString.replace(/[{}]/g, "");
  if (!cleaned.trim()) return [];

  return cleaned
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

// 카테고리에서 슬러그 생성
function createSlug(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣-]/g, "")
    .trim();
}

// 사용자 데이터 마이그레이션
async function migrateUsers() {
  console.log("👤 사용자 데이터 마이그레이션 시작...");

  const userData = parseDatFile(path.join(process.cwd(), "prisma/blog_9btt_rgor/3432.dat"));

  for (const row of userData) {
    const [id, email, name, createdAt, updatedAt, isOwner] = row;

    try {
      await prisma.user.create({
        data: {
          id,
          email,
          name,
          createdAt: new Date(createdAt),
          updatedAt: new Date(updatedAt),
          isOwner: isOwner === true,
        },
      });
      console.log(`✅ 사용자 생성: ${email}`);
    } catch (error) {
      if (error.code === "P2002") {
        console.log(`⚠️  사용자 이미 존재: ${email}`);
      } else {
        console.error(`❌ 사용자 생성 실패 (${email}):`, error.message);
      }
    }
  }

  console.log("✅ 사용자 데이터 마이그레이션 완료\n");
}

// 카테고리 데이터 생성
async function createCategories() {
  console.log("📁 카테고리 데이터 생성 시작...");

  const postData = parseDatFile(path.join(process.cwd(), "prisma/blog_9btt_rgor/3434.dat"));

  // 고유 카테고리 추출
  const categories = new Set();
  postData.forEach((row) => {
    const category = row[2]; // 카테고리는 3번째 컬럼
    if (category && category !== "\\N") {
      categories.add(category);
    }
  });

  // 카테고리 생성
  for (const categoryName of categories) {
    try {
      const slug = createSlug(categoryName);
      await prisma.category.create({
        data: {
          name: categoryName,
          slug,
        },
      });
      console.log(`✅ 카테고리 생성: ${categoryName} (${slug})`);
    } catch (error) {
      if (error.code === "P2002") {
        console.log(`⚠️  카테고리 이미 존재: ${categoryName}`);
      } else {
        console.error(`❌ 카테고리 생성 실패 (${categoryName}):`, error.message);
      }
    }
  }

  console.log("✅ 카테고리 데이터 생성 완료\n");
}

// 태그 데이터 생성
async function createTags() {
  console.log("🏷️  태그 데이터 생성 시작...");

  const postData = parseDatFile(path.join(process.cwd(), "prisma/blog_9btt_rgor/3434.dat"));

  // 고유 태그 추출
  const tags = new Set();
  postData.forEach((row) => {
    const tagsString = row[5]; // 태그는 6번째 컬럼
    const postTags = parseTags(tagsString);
    postTags.forEach((tag) => tags.add(tag));
  });

  // 태그 생성
  for (const tagName of tags) {
    try {
      const slug = createSlug(tagName);
      await prisma.tag.create({
        data: {
          name: tagName,
          slug,
        },
      });
      console.log(`✅ 태그 생성: ${tagName} (${slug})`);
    } catch (error) {
      if (error.code === "P2002") {
        console.log(`⚠️  태그 이미 존재: ${tagName}`);
      } else {
        console.error(`❌ 태그 생성 실패 (${tagName}):`, error.message);
      }
    }
  }

  console.log("✅ 태그 데이터 생성 완료\n");
}

// 포스트 데이터 마이그레이션
async function migratePosts() {
  console.log("📝 포스트 데이터 마이그레이션 시작...");

  const postData = parseDatFile(path.join(process.cwd(), "prisma/blog_9btt_rgor/3434.dat"));

  for (const row of postData) {
    const [id, thumbnail, category, title, content, tagsString, likes, createdAt, updatedAt, userId, slug, choseongTitle, isPrivate] = row;

    try {
      // 카테고리 ID 찾기
      let categoryId = null;
      if (category && category !== "\\N") {
        const categoryRecord = await prisma.category.findFirst({
          where: { name: category },
        });
        categoryId = categoryRecord?.id || null;
      }

      // 포스트 생성
      const post = await prisma.post.create({
        data: {
          id: parseInt(id),
          thumbnail: thumbnail === "\\N" ? null : thumbnail,
          categoryId,
          title,
          content,
          likesCount: parseInt(likes),
          views: 0, // 기본값
          createdAt: new Date(createdAt),
          updatedAt: new Date(updatedAt),
          slug,
          choseongTitle,
          isPrivate: isPrivate === true,
        },
      });

      // 태그 연결
      const postTags = parseTags(tagsString);
      if (postTags.length > 0) {
        const tagRecords = await prisma.tag.findMany({
          where: {
            name: { in: postTags },
          },
        });

        if (tagRecords.length > 0) {
          await prisma.post.update({
            where: { id: post.id },
            data: {
              tags: {
                connect: tagRecords.map((tag) => ({ id: tag.id })),
              },
            },
          });
        }
      }

      console.log(`✅ 포스트 생성: ${title} (ID: ${id})`);
    } catch (error) {
      if (error.code === "P2002") {
        console.log(`⚠️  포스트 이미 존재: ${title} (ID: ${id})`);
      } else {
        console.error(`❌ 포스트 생성 실패 (ID: ${id}):`, error.message);
      }
    }
  }

  console.log("✅ 포스트 데이터 마이그레이션 완료\n");
}

// 댓글 데이터 마이그레이션
async function migrateComments() {
  console.log("💬 댓글 데이터 마이그레이션 시작...");

  const commentData = parseDatFile(path.join(process.cwd(), "prisma/blog_9btt_rgor/3436.dat"));

  for (const row of commentData) {
    const [id, content, likes, createdAt, updatedAt, userId, postId, parentCommentId] = row;

    try {
      // depth 계산 (부모 댓글이 있으면 depth 증가)
      let depth = 0;
      if (parentCommentId && parentCommentId !== "\\N") {
        const parentComment = await prisma.comment.findUnique({
          where: { id: parseInt(parentCommentId) },
        });
        if (parentComment) {
          depth = parentComment.depth + 1;
        }
      }

      await prisma.comment.create({
        data: {
          id: parseInt(id),
          content,
          likesCount: parseInt(likes),
          createdAt: new Date(createdAt),
          updatedAt: new Date(updatedAt),
          userId,
          postId: parseInt(postId),
          parentCommentId: parentCommentId === "\\N" ? null : parseInt(parentCommentId),
          isDeleted: false, // 기본값
          isEdited: false, // 기본값
          depth,
        },
      });

      console.log(`✅ 댓글 생성: ID ${id} (포스트: ${postId})`);
    } catch (error) {
      if (error.code === "P2002") {
        console.log(`⚠️  댓글 이미 존재: ID ${id}`);
      } else {
        console.error(`❌ 댓글 생성 실패 (ID: ${id}):`, error.message);
      }
    }
  }

  console.log("✅ 댓글 데이터 마이그레이션 완료\n");
}

// 시퀀스 재설정
async function resetSequences() {
  console.log("🔄 시퀀스 재설정 시작...");

  try {
    // 포스트 ID 시퀀스 재설정
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('posts', 'id'), (SELECT MAX(id) FROM posts));`;
    console.log("✅ 포스트 ID 시퀀스 재설정 완료");

    // 댓글 ID 시퀀스 재설정
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('comments', 'id'), (SELECT MAX(id) FROM comments));`;
    console.log("✅ 댓글 ID 시퀀스 재설정 완료");

    // 카테고리 ID 시퀀스 재설정
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('categories', 'id'), (SELECT MAX(id) FROM categories));`;
    console.log("✅ 카테고리 ID 시퀀스 재설정 완료");

    // 태그 ID 시퀀스 재설정
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('tags', 'id'), (SELECT MAX(id) FROM tags));`;
    console.log("✅ 태그 ID 시퀀스 재설정 완료");
  } catch (error) {
    console.error("❌ 시퀀스 재설정 실패:", error.message);
  }

  console.log("✅ 시퀀스 재설정 완료\n");
}

// 데이터 검증
async function verifyData() {
  console.log("🔍 데이터 검증 시작...");

  const userCount = await prisma.user.count();
  const categoryCount = await prisma.category.count();
  const tagCount = await prisma.tag.count();
  const postCount = await prisma.post.count();
  const commentCount = await prisma.comment.count();

  console.log(`📊 마이그레이션 결과:`);
  console.log(`   - 사용자: ${userCount}개`);
  console.log(`   - 카테고리: ${categoryCount}개`);
  console.log(`   - 태그: ${tagCount}개`);
  console.log(`   - 포스트: ${postCount}개`);
  console.log(`   - 댓글: ${commentCount}개`);

  console.log("✅ 데이터 검증 완료\n");
}

// 메인 실행 함수
async function main() {
  console.log("🚀 블로그 데이터 마이그레이션 시작!\n");

  try {
    await migrateUsers();
    await createCategories();
    await createTags();
    await migratePosts();
    await migrateComments();
    await resetSequences();
    await verifyData();

    console.log("🎉 블로그 데이터 마이그레이션이 성공적으로 완료되었습니다!");
  } catch (error) {
    console.error("💥 마이그레이션 중 오류 발생:", error);
    throw error;
  }
}

// 스크립트 실행
main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("✅ 데이터베이스 연결 종료");
  })
  .catch(async (e) => {
    console.error("💥 마이그레이션 실패:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
