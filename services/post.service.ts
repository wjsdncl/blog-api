/**
 * Post Service
 * 게시글 관련 비즈니스 로직
 */
import { prisma } from "@/lib/prismaClient.js";
import { NotFoundError, BadRequestError } from "@/lib/errors.js";
import { generateUniqueSlug } from "@/utils/slug.js";
import { calculatePublishedAt } from "@/utils/prismaHelpers.js";

// ============================================
// Types
// ============================================

export interface CreatePostInput {
  title: string;
  content: string;
  excerpt?: string;
  cover_image?: string;
  status: "DRAFT" | "PUBLISHED" | "SCHEDULED";
  category_id?: string | null;
  tag_ids?: string[];
  published_at?: Date;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
  excerpt?: string;
  cover_image?: string;
  status?: "DRAFT" | "PUBLISHED" | "SCHEDULED";
  category_id?: string | null;
  tag_ids?: string[];
  published_at?: Date;
}

// Select Objects
const postListSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  cover_image: true,
  status: true,
  view_count: true,
  like_count: true,
  comment_count: true,
  published_at: true,
  created_at: true,
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  tags: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} as const;

export const postDetailSelect = {
  ...postListSelect,
  content: true,
  updated_at: true,
} as const;

// ============================================
// Service Functions
// ============================================

/**
 * 게시글 생성
 * - 슬러그 자동 생성
 * - PUBLISHED 상태 시 카테고리 post_count 증가
 */
export async function createPost(input: CreatePostInput) {
  // 슬러그 자동 생성
  const slug = await generateUniqueSlug("post", input.title);

  // 카테고리 존재 확인
  if (input.category_id) {
    const category = await prisma.category.findUnique({
      where: { id: input.category_id },
    });
    if (!category) {
      throw new BadRequestError("존재하지 않는 카테고리입니다.");
    }
  }

  // 발행 상태에 따른 published_at 설정
  let publishedAt = input.published_at;
  if (input.status === "PUBLISHED" && !publishedAt) {
    publishedAt = new Date();
  }

  const shouldIncrementCount = input.status === "PUBLISHED";

  return prisma.$transaction(async (tx) => {
    const post = await tx.post.create({
      data: {
        title: input.title,
        slug,
        content: input.content,
        excerpt: input.excerpt,
        cover_image: input.cover_image,
        status: input.status,
        category_id: input.category_id,
        published_at: publishedAt,
        ...(input.tag_ids && {
          tags: {
            connect: input.tag_ids.map((id) => ({ id })),
          },
        }),
      },
      select: postDetailSelect,
    });

    // PUBLISHED 상태일 때만 카테고리 카운트 증가
    if (shouldIncrementCount && input.category_id) {
      await tx.category.update({
        where: { id: input.category_id },
        data: { post_count: { increment: 1 } },
      });
    }

    return post;
  });
}

/**
 * 게시글 수정
 * - 제목 변경 시 슬러그 재생성
 * - 상태/카테고리 변경 시 post_count 동기화
 */
export async function updatePost(id: string, input: UpdatePostInput) {
  // 기존 게시글 정보
  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      category_id: true,
    },
  });

  if (!post) {
    throw new NotFoundError("게시글");
  }

  // 제목 변경 시 슬러그 재생성
  let newSlug: string | undefined;
  if (input.title && input.title !== post.title) {
    newSlug = await generateUniqueSlug("post", input.title, id);
  }

  // 카테고리 존재 확인
  if (input.category_id) {
    const category = await prisma.category.findUnique({
      where: { id: input.category_id },
    });
    if (!category) {
      throw new BadRequestError("존재하지 않는 카테고리입니다.");
    }
  }

  // 발행 상태 변경 시 published_at 설정
  const publishedAt = calculatePublishedAt(input.status, input.published_at, post.status);

  // post_count 동기화를 위한 상태 계산
  const oldStatus = post.status;
  const newStatus = input.status || oldStatus;
  const wasPublished = oldStatus === "PUBLISHED";
  const willBePublished = newStatus === "PUBLISHED";

  const oldCategoryId = post.category_id;
  const newCategoryId = input.category_id !== undefined ? input.category_id : oldCategoryId;
  const categoryChanged = input.category_id !== undefined && oldCategoryId !== newCategoryId;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.post.update({
      where: { id },
      data: {
        ...(input.title && { title: input.title }),
        ...(newSlug && { slug: newSlug }),
        ...(input.content && { content: input.content }),
        ...(input.excerpt !== undefined && { excerpt: input.excerpt }),
        ...(input.cover_image !== undefined && { cover_image: input.cover_image }),
        ...(input.status && { status: input.status }),
        ...(input.category_id !== undefined && { category_id: input.category_id }),
        ...(publishedAt && { published_at: publishedAt }),
        ...(input.tag_ids && {
          tags: {
            set: input.tag_ids.map((tagId) => ({ id: tagId })),
          },
        }),
      },
      select: postDetailSelect,
    });

    // 카테고리 post_count 동기화
    await syncCategoryPostCount(tx, {
      wasPublished,
      willBePublished,
      categoryChanged,
      oldCategoryId,
      newCategoryId,
    });

    return updated;
  });
}

/**
 * 게시글 삭제
 * - PUBLISHED 상태 시 카테고리 post_count 감소
 */
export async function deletePost(id: string) {
  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      category_id: true,
    },
  });

  if (!post) {
    throw new NotFoundError("게시글");
  }

  const shouldDecrementCount = post.status === "PUBLISHED";

  await prisma.$transaction(async (tx) => {
    await tx.post.delete({ where: { id } });

    if (shouldDecrementCount && post.category_id) {
      await tx.category.update({
        where: { id: post.category_id },
        data: { post_count: { decrement: 1 } },
      });
    }
  });
}

// ============================================
// Helper Functions
// ============================================

interface SyncCategoryCountParams {
  wasPublished: boolean;
  willBePublished: boolean;
  categoryChanged: boolean;
  oldCategoryId: string | null;
  newCategoryId: string | null | undefined;
}

/**
 * 카테고리 post_count 동기화
 */
async function syncCategoryPostCount(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  params: SyncCategoryCountParams,
) {
  const { wasPublished, willBePublished, categoryChanged, oldCategoryId, newCategoryId } = params;

  if (wasPublished && !willBePublished) {
    // PUBLISHED → DRAFT: 기존 카테고리 -1
    if (oldCategoryId) {
      await tx.category.update({
        where: { id: oldCategoryId },
        data: { post_count: { decrement: 1 } },
      });
    }
  } else if (!wasPublished && willBePublished) {
    // DRAFT → PUBLISHED: 새 카테고리 +1
    if (newCategoryId) {
      await tx.category.update({
        where: { id: newCategoryId },
        data: { post_count: { increment: 1 } },
      });
    }
  } else if (wasPublished && willBePublished && categoryChanged) {
    // PUBLISHED 유지 + 카테고리 변경: 이전 -1, 새 +1
    if (oldCategoryId) {
      await tx.category.update({
        where: { id: oldCategoryId },
        data: { post_count: { decrement: 1 } },
      });
    }
    if (newCategoryId) {
      await tx.category.update({
        where: { id: newCategoryId },
        data: { post_count: { increment: 1 } },
      });
    }
  }
}
