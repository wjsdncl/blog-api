import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// 환경 확인
const isProduction = process.env.NODE_ENV === "production";
const isRender = process.env.RENDER === "true";

console.log(`🌍 실행 환경: ${process.env.NODE_ENV || "development"}`);
console.log(`🚀 Render 환경: ${isRender ? "예" : "아니오"}`);

// .dat 파일을 읽고 파싱하는 함수
function parseDatFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ 파일을 찾을 수 없습니다: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");

  return lines.map((line) => {
    const columns = line.split("\t");
    return columns.map((col) => {
      if (col === "\\N") return null;
      if (col === "t") return true;
      if (col === "f") return false;
      return col;
    });
  });
}

// 태그 문자열 파싱 함수
function parseTags(tagsString) {
  if (!tagsString || tagsString === "\\N") return [];

  const cleaned = tagsString.replace(/[{}]/g, "");
  if (!cleaned.trim()) return [];

  return cleaned
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

// 이미지 배열 파싱 함수
function parseImages(imagesString) {
  if (!imagesString || imagesString === "\\N") return [];

  const cleaned = imagesString.replace(/[{}]/g, "");
  if (!cleaned.trim()) return [];

  return cleaned
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}

// Summary 배열 파싱 함수
function parseSummary(summaryString) {
  if (!summaryString || summaryString === "\\N") return [];

  try {
    const cleaned = summaryString.replace(/"/g, '"');
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Summary 파싱 실패:", summaryString);
    return [];
  }
}

// 카테고리에서 슬러그 생성
function createSlug(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣-]/g, "")
    .trim();
}

// 데이터가 이미 존재하는지 확인
async function checkExistingData() {
  const userCount = await prisma.user.count();
  const postCount = await prisma.post.count();

  console.log(`📊 현재 데이터 상태:`);
  console.log(`   - 사용자: ${userCount}개`);
  console.log(`   - 포스트: ${postCount}개`);

  if (userCount > 0 || postCount > 0) {
    console.log("⚠️ 기존 데이터가 존재합니다.");

    if (isProduction && !process.env.FORCE_MIGRATION) {
      console.log("🛑 프로덕션 환경에서는 안전을 위해 마이그레이션을 중단합니다.");
      console.log("강제로 실행하려면 FORCE_MIGRATION=true 환경변수를 설정하세요.");
      return false;
    }
  }

  return true;
}

// 사용자 데이터 마이그레이션
async function migrateUsers() {
  console.log("👤 사용자 데이터 마이그레이션 시작...");

  const dataPath = path.join(process.cwd(), "prisma", "blog_9btt_rgor", "3431.dat");

  if (!fs.existsSync(dataPath)) {
    console.log("ℹ️ 사용자 데이터 파일이 없습니다. 건너뜁니다.");
    return;
  }

  const userData = parseDatFile(dataPath);

  for (const [id, email, name, created_at, updated_at, is_owner] of userData) {
    try {
      await prisma.user.upsert({
        where: { id },
        update: {},
        create: {
          id,
          email,
          name,
          createdAt: new Date(created_at),
          updatedAt: new Date(updated_at),
          isOwner: is_owner === true,
        },
      });
    } catch (error) {
      console.warn(`⚠️ 사용자 생성 실패: ${email}`, error.message);
    }
  }

  console.log(`✅ 사용자 ${userData.length}개 마이그레이션 완료\n`);
}

// 카테고리 생성
async function createCategories() {
  console.log("📁 카테고리 생성 시작...");

  const categories = [
    { name: "개발", slug: "development" },
    { name: "일상", slug: "daily" },
    { name: "기술", slug: "tech" },
    { name: "프로젝트", slug: "project" },
  ];

  for (const category of categories) {
    try {
      await prisma.category.upsert({
        where: { slug: category.slug },
        update: {},
        create: category,
      });
    } catch (error) {
      console.warn(`⚠️ 카테고리 생성 실패: ${category.name}`, error.message);
    }
  }

  console.log(`✅ 카테고리 ${categories.length}개 생성 완료\n`);
}

// 태그 생성
async function createTags() {
  console.log("🏷️ 태그 생성 시작...");

  const dataPath = path.join(process.cwd(), "prisma", "blog_9btt_rgor", "3440.dat");

  if (!fs.existsSync(dataPath)) {
    console.log("ℹ️ 태그 데이터 파일이 없습니다. 건너뜁니다.");
    return;
  }

  const tagData = parseDatFile(dataPath);

  for (const [id, name, created_at] of tagData) {
    try {
      await prisma.tag.upsert({
        where: { slug: createSlug(name) },
        update: {},
        create: {
          name,
          slug: createSlug(name),
          createdAt: new Date(created_at),
        },
      });
    } catch (error) {
      console.warn(`⚠️ 태그 생성 실패: ${name}`, error.message);
    }
  }

  console.log(`✅ 태그 ${tagData.length}개 생성 완료\n`);
}

// 포스트 마이그레이션
async function migratePosts() {
  console.log("📝 포스트 데이터 마이그레이션 시작...");

  const dataPath = path.join(process.cwd(), "prisma", "blog_9btt_rgor", "3436.dat");

  if (!fs.existsSync(dataPath)) {
    console.log("ℹ️ 포스트 데이터 파일이 없습니다. 건너뜁니다.");
    return;
  }

  const postData = parseDatFile(dataPath);

  for (const row of postData) {
    const [id, thumbnail, category_id, title, content, likes_count, views, created_at, updated_at, slug, choseong_title, is_private, tags_string] = row;

    try {
      const tagNames = parseTags(tags_string);
      const tags = [];

      for (const tagName of tagNames) {
        const tag = await prisma.tag.findFirst({
          where: { name: tagName.trim() },
        });
        if (tag) {
          tags.push({ id: tag.id });
        }
      }

      await prisma.post.upsert({
        where: { slug },
        update: {},
        create: {
          id: parseInt(id),
          thumbnail,
          categoryId: category_id ? parseInt(category_id) : null,
          title,
          content,
          likesCount: parseInt(likes_count) || 0,
          views: parseInt(views) || 0,
          createdAt: new Date(created_at),
          updatedAt: new Date(updated_at),
          slug,
          choseongTitle: choseong_title || title,
          isPrivate: is_private === true,
          tags: {
            connect: tags,
          },
        },
      });
    } catch (error) {
      console.warn(`⚠️ 포스트 생성 실패: ${title}`, error.message);
    }
  }

  console.log(`✅ 포스트 ${postData.length}개 마이그레이션 완료\n`);
}

// 댓글 마이그레이션
async function migrateComments() {
  console.log("💬 댓글 데이터 마이그레이션 시작...");

  const dataPath = path.join(process.cwd(), "prisma", "blog_9btt_rgor", "3438.dat");

  if (!fs.existsSync(dataPath)) {
    console.log("ℹ️ 댓글 데이터 파일이 없습니다. 건너뜁니다.");
    return;
  }

  const commentData = parseDatFile(dataPath);

  for (const row of commentData) {
    const [id, content, likes_count, created_at, updated_at, user_id, post_id, parent_comment_id, is_deleted, is_edited, depth] = row;

    try {
      await prisma.comment.upsert({
        where: { id: parseInt(id) },
        update: {},
        create: {
          id: parseInt(id),
          content,
          likesCount: parseInt(likes_count) || 0,
          createdAt: new Date(created_at),
          updatedAt: new Date(updated_at),
          userId: user_id,
          postId: parseInt(post_id),
          parentCommentId: parent_comment_id ? parseInt(parent_comment_id) : null,
          isDeleted: is_deleted === true,
          isEdited: is_edited === true,
          depth: parseInt(depth) || 0,
        },
      });
    } catch (error) {
      console.warn(`⚠️ 댓글 생성 실패 (ID: ${id})`, error.message);
    }
  }

  console.log(`✅ 댓글 ${commentData.length}개 마이그레이션 완료\n`);
}

// 프로젝트 마이그레이션
async function migrateProjects() {
  console.log("🎯 프로젝트 데이터 마이그레이션 시작...");

  const dataPath = path.join(process.cwd(), "prisma", "blog_9btt_rgor", "3440.dat");
  
  if (!fs.existsSync(dataPath)) {
    console.log("ℹ️ 프로젝트 데이터 파일이 없습니다. 건너뜁니다.");
    return;
  }

  const projectData = parseDatFile(dataPath);

  for (const row of projectData) {
    const [
      id,
      title,
      start_date,
      end_date,
      description,
      summary,
      tech_stack,
      github_url,
      demo_url,
      created_at,
      updated_at,
      is_personal,
      content,
      images
    ] = row;

    try {
      // 기술 스택 생성
      const techStackNames = parseTags(tech_stack);
      const techStacks = [];

      for (const techName of techStackNames) {
        try {
          const techStack = await prisma.techStack.upsert({
            where: { name: techName },
            update: {},
            create: { name: techName }
          });
          techStacks.push({ id: techStack.id });
        } catch (error) {
          console.warn(`⚠️ 기술 스택 생성 실패: ${techName}`, error.message);
        }
      }

      // 프로젝트 카테고리 확인/생성
      let categoryId = null;
      const categoryRecord = await prisma.category.findFirst({
        where: { name: "프로젝트" }
      });
      if (!categoryRecord) {
        const newCategory = await prisma.category.create({
          data: {
            name: "프로젝트",
            slug: "project"
          }
        });
        categoryId = newCategory.id;
      } else {
        categoryId = categoryRecord.id;
      }

      await prisma.project.upsert({
        where: { slug: createSlug(title) },
        update: {},
        create: {
          id: parseInt(id),
          title,
          slug: createSlug(title),
          description: description || "",
          content: content || "",
          images: parseImages(images),
          summary: parseSummary(summary),
          status: "COMPLETED",
          categoryId,
          startDate: new Date(start_date),
          endDate: end_date === "\\N" ? null : new Date(end_date),
          isPersonal: is_personal === true,
          isActive: true,
          priority: 0,
          createdAt: new Date(created_at),
          updatedAt: new Date(updated_at),
          techStack: {
            connect: techStacks
          }
        }
      });

      // 프로젝트 링크 생성
      const project = await prisma.project.findUnique({
        where: { slug: createSlug(title) }
      });

      if (project) {
        // 기존 링크가 있는지 확인하고 중복 방지
        if (github_url && github_url !== "\\N") {
          const existingGithubLink = await prisma.projectLink.findFirst({
            where: { 
              projectId: project.id, 
              title: "GitHub" 
            }
          });
          
          if (!existingGithubLink) {
            await prisma.projectLink.create({
              data: {
                title: "GitHub",
                url: github_url,
                projectId: project.id
              }
            });
          }
        }

        if (demo_url && demo_url !== "\\N") {
          const existingDemoLink = await prisma.projectLink.findFirst({
            where: { 
              projectId: project.id, 
              title: "Demo" 
            }
          });
          
          if (!existingDemoLink) {
            await prisma.projectLink.create({
              data: {
                title: "Demo",
                url: demo_url,
                projectId: project.id
              }
            });
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ 프로젝트 생성 실패: ${title}`, error.message);
    }
  }

  console.log(`✅ 프로젝트 ${projectData.length}개 마이그레이션 완료\n`);
}

// 데이터 검증
async function verifyData() {
  console.log("🔍 데이터 검증 시작...");

  const userCount = await prisma.user.count();
  const categoryCount = await prisma.category.count();
  const tagCount = await prisma.tag.count();
  const postCount = await prisma.post.count();
  const commentCount = await prisma.comment.count();
  const projectCount = await prisma.project.count();
  const techStackCount = await prisma.techStack.count();

  console.log(`📊 마이그레이션 결과:`);
  console.log(`   - 사용자: ${userCount}개`);
  console.log(`   - 카테고리: ${categoryCount}개`);
  console.log(`   - 태그: ${tagCount}개`);
  console.log(`   - 포스트: ${postCount}개`);
  console.log(`   - 댓글: ${commentCount}개`);
  console.log(`   - 프로젝트: ${projectCount}개`);
  console.log(`   - 기술스택: ${techStackCount}개`);

  console.log("✅ 데이터 검증 완료\n");
}

// 메인 실행 함수
async function main() {
  console.log("🚀 환경별 블로그 데이터 마이그레이션 시작!\n");

  try {
    // 기존 데이터 확인
    const canProceed = await checkExistingData();
    if (!canProceed) {
      console.log("❌ 마이그레이션이 중단되었습니다.");
      return;
    }

    await migrateUsers();
    await createCategories();
    await createTags();
    await migratePosts();
    await migrateComments();
    await migrateProjects();
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
