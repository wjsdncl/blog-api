import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface SeedData {
  users: Array<{
    id: string;
    username: string;
    email: string;
    role: "OWNER" | "USER";
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
  categories: Array<{
    id: string;
    name: string;
    order: number;
    post_count: number;
    created_at: string;
    updated_at: string;
  }>;
  tags: Array<{
    id: string;
    name: string;
    slug: string;
    created_at: string;
    updated_at: string;
  }>;
  tech_stacks: Array<{
    id: string;
    name: string;
    category: string | null;
    created_at: string;
    updated_at: string;
  }>;
  posts: Array<{
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt: string | null;
    cover_image: string | null;
    status: "DRAFT" | "PUBLISHED" | "SCHEDULED";
    view_count: number;
    like_count: number;
    comment_count: number;
    category_id: string | null;
    published_at: string | null;
    created_at: string;
    updated_at: string;
    tag_ids: string[];
  }>;
  comments: Array<{
    id: string;
    content: string;
    post_id: string;
    author_id: string;
    parent_id: string | null;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
  portfolios: Array<{
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt: string | null;
    cover_image: string | null;
    start_date: string | null;
    end_date: string | null;
    status: "DRAFT" | "PUBLISHED" | "SCHEDULED";
    view_count: number;
    order: number;
    category_id: string | null;
    published_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
  portfolio_links: Array<{
    id: string;
    portfolio_id: string;
    type: string;
    url: string;
    label: string | null;
    order: number;
    created_at: string;
    updated_at: string;
  }>;
}

function loadData(): SeedData {
  const dataPath = resolve(__dirname, "../../backup/database/migrated_data.json");
  const raw = readFileSync(dataPath, "utf-8");
  return JSON.parse(raw) as SeedData;
}

function sortComments(comments: SeedData["comments"]): SeedData["comments"] {
  const idSet = new Set(comments.map((c) => c.id));
  const sorted: SeedData["comments"] = [];
  const remaining = [...comments];

  // Topological sort: insert parents before children
  while (remaining.length > 0) {
    const before = remaining.length;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const c = remaining[i];
      if (!c.parent_id || !idSet.has(c.parent_id) || sorted.some((s) => s.id === c.parent_id)) {
        sorted.push(c);
        remaining.splice(i, 1);
      }
    }
    if (remaining.length === before) {
      // Circular reference fallback — push remaining as-is
      sorted.push(...remaining);
      break;
    }
  }

  return sorted;
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const data = loadData();

  console.log("=== Seed 시작 ===\n");

  // 1. Users
  for (const u of data.users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {
        username: u.username,
        email: u.email,
        role: u.role,
        is_active: u.is_active,
        updated_at: new Date(u.updated_at),
      },
      create: {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        is_active: u.is_active,
        created_at: new Date(u.created_at),
        updated_at: new Date(u.updated_at),
      },
    });
  }
  console.log(`✓ users: ${data.users.length}건`);

  // 2. Categories
  for (const c of data.categories) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        order: c.order,
        post_count: c.post_count,
        updated_at: new Date(c.updated_at),
      },
      create: {
        id: c.id,
        name: c.name,
        order: c.order,
        post_count: c.post_count,
        created_at: new Date(c.created_at),
        updated_at: new Date(c.updated_at),
      },
    });
  }
  console.log(`✓ categories: ${data.categories.length}건`);

  // 3. Tags
  for (const t of data.tags) {
    await prisma.tag.upsert({
      where: { id: t.id },
      update: {
        name: t.name,
        slug: t.slug,
        updated_at: new Date(t.updated_at),
      },
      create: {
        id: t.id,
        name: t.name,
        slug: t.slug,
        created_at: new Date(t.created_at),
        updated_at: new Date(t.updated_at),
      },
    });
  }
  console.log(`✓ tags: ${data.tags.length}건`);

  // 4. TechStacks
  for (const ts of data.tech_stacks) {
    await prisma.techStack.upsert({
      where: { id: ts.id },
      update: {
        name: ts.name,
        category: ts.category,
        updated_at: new Date(ts.updated_at),
      },
      create: {
        id: ts.id,
        name: ts.name,
        category: ts.category,
        created_at: new Date(ts.created_at),
        updated_at: new Date(ts.updated_at),
      },
    });
  }
  console.log(`✓ tech_stacks: ${data.tech_stacks.length}건`);

  // 5. Posts (with tag connections)
  for (const p of data.posts) {
    const { tag_ids, ...postData } = p;
    await prisma.post.upsert({
      where: { id: postData.id },
      update: {
        title: postData.title,
        slug: postData.slug,
        content: postData.content,
        excerpt: postData.excerpt,
        cover_image: postData.cover_image,
        status: postData.status,
        view_count: postData.view_count,
        like_count: postData.like_count,
        comment_count: postData.comment_count,
        category_id: postData.category_id,
        published_at: postData.published_at ? new Date(postData.published_at) : null,
        updated_at: new Date(postData.updated_at),
        tags: { set: tag_ids.map((id) => ({ id })) },
      },
      create: {
        id: postData.id,
        title: postData.title,
        slug: postData.slug,
        content: postData.content,
        excerpt: postData.excerpt,
        cover_image: postData.cover_image,
        status: postData.status,
        view_count: postData.view_count,
        like_count: postData.like_count,
        comment_count: postData.comment_count,
        category_id: postData.category_id,
        published_at: postData.published_at ? new Date(postData.published_at) : null,
        created_at: new Date(postData.created_at),
        updated_at: new Date(postData.updated_at),
        tags: { connect: tag_ids.map((id) => ({ id })) },
      },
    });
  }
  console.log(`✓ posts: ${data.posts.length}건`);

  // 6. Comments (topological sort: parents first)
  const sortedComments = sortComments(data.comments);
  for (const c of sortedComments) {
    await prisma.comment.upsert({
      where: { id: c.id },
      update: {
        content: c.content,
        post_id: c.post_id,
        author_id: c.author_id,
        parent_id: c.parent_id,
        deleted_at: c.deleted_at ? new Date(c.deleted_at) : null,
        updated_at: new Date(c.updated_at),
      },
      create: {
        id: c.id,
        content: c.content,
        post_id: c.post_id,
        author_id: c.author_id,
        parent_id: c.parent_id,
        deleted_at: c.deleted_at ? new Date(c.deleted_at) : null,
        created_at: new Date(c.created_at),
        updated_at: new Date(c.updated_at),
      },
    });
  }
  console.log(`✓ comments: ${data.comments.length}건`);

  // 7. Portfolios (no tag/techStack connections in backup data)
  for (const pf of data.portfolios) {
    await prisma.portfolio.upsert({
      where: { id: pf.id },
      update: {
        title: pf.title,
        slug: pf.slug,
        content: pf.content,
        excerpt: pf.excerpt,
        cover_image: pf.cover_image,
        start_date: pf.start_date ? new Date(pf.start_date) : null,
        end_date: pf.end_date ? new Date(pf.end_date) : null,
        status: pf.status,
        view_count: pf.view_count,
        order: pf.order,
        category_id: pf.category_id,
        published_at: pf.published_at ? new Date(pf.published_at) : null,
        updated_at: new Date(pf.updated_at),
      },
      create: {
        id: pf.id,
        title: pf.title,
        slug: pf.slug,
        content: pf.content,
        excerpt: pf.excerpt,
        cover_image: pf.cover_image,
        start_date: pf.start_date ? new Date(pf.start_date) : null,
        end_date: pf.end_date ? new Date(pf.end_date) : null,
        status: pf.status,
        view_count: pf.view_count,
        order: pf.order,
        category_id: pf.category_id,
        published_at: pf.published_at ? new Date(pf.published_at) : null,
        created_at: new Date(pf.created_at),
        updated_at: new Date(pf.updated_at),
      },
    });
  }
  console.log(`✓ portfolios: ${data.portfolios.length}건`);

  // 8. Portfolio Links
  for (const pl of data.portfolio_links) {
    await prisma.portfolioLink.upsert({
      where: { id: pl.id },
      update: {
        portfolio_id: pl.portfolio_id,
        type: pl.type,
        url: pl.url,
        label: pl.label,
        order: pl.order,
        updated_at: new Date(pl.updated_at),
      },
      create: {
        id: pl.id,
        portfolio_id: pl.portfolio_id,
        type: pl.type,
        url: pl.url,
        label: pl.label,
        order: pl.order,
        created_at: new Date(pl.created_at),
        updated_at: new Date(pl.updated_at),
      },
    });
  }
  console.log(`✓ portfolio_links: ${data.portfolio_links.length}건`);

  console.log("\n=== Seed 완료 ===");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error("Seed 실패:", e);
  process.exit(1);
});
