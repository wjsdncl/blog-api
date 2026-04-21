/**
 * 게시글 서비스
 *
 * 모든 CUD 작업은 트랜잭션으로 처리.
 * 게시글 상태(DRAFT/PUBLISHED/SCHEDULED) 변경 시 카테고리의 post_count를 자동 동기화.
 */
import { prisma } from "@/lib/prismaClient.js";
import { NotFoundError } from "@/lib/errors.js";
import { generateUniqueSlug } from "@/utils/slug.js";
import { calculatePublishedAt, validateCategoryId } from "@/utils/prismaHelpers.js";

export interface CreatePostInput {
  title: string;
  content: string;
  excerpt?: string;
  cover_image?: string | null;
  status: "DRAFT" | "PUBLISHED" | "SCHEDULED";
  category_id?: string | null;
  tag_ids?: string[];
  published_at?: Date;
}

export type UpdatePostInput = Partial<CreatePostInput>;

export const postListSelect = {
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

/**
 * 게시글 생성
 * - 슬러그 자동 생성
 * - PUBLISHED 상태 시 카테고리 post_count 증가
 */
export async function createPost(input: CreatePostInput) {
  const slug = await generateUniqueSlug("post", input.title);

  await validateCategoryId(input.category_id);

  let publishedAt = input.published_at;
  if (input.status === "PUBLISHED" && !publishedAt) {
    publishedAt = new Date();
  }

  const createOp = prisma.post.create({
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

  const shouldIncrementCount = input.status === "PUBLISHED" && input.category_id;

  if (shouldIncrementCount) {
    const [post] = await prisma.$transaction([
      createOp,
      prisma.category.update({
        where: { id: input.category_id! },
        data: { post_count: { increment: 1 } },
      }),
    ]);
    return post;
  }

  return createOp;
}

/**
 * 게시글 수정
 * - 제목 변경 시 슬러그 재생성
 * - 상태/카테고리 변경 시 post_count 동기화
 */
export async function updatePost(id: string, input: UpdatePostInput) {
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

  let newSlug: string | undefined;
  if (input.title && input.title !== post.title) {
    newSlug = await generateUniqueSlug("post", input.title, id);
  }

  await validateCategoryId(input.category_id);

  const publishedAt = calculatePublishedAt(input.status, input.published_at, post.status);

  // post_count 동기화를 위한 상태 계산
  const oldStatus = post.status;
  const newStatus = input.status || oldStatus;
  const wasPublished = oldStatus === "PUBLISHED";
  const willBePublished = newStatus === "PUBLISHED";

  const oldCategoryId = post.category_id;
  const newCategoryId = input.category_id !== undefined ? input.category_id : oldCategoryId;
  const categoryChanged = input.category_id !== undefined && oldCategoryId !== newCategoryId;

  const updateOp = prisma.post.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(newSlug && { slug: newSlug }),
      ...(input.content !== undefined && { content: input.content }),
      ...(input.excerpt !== undefined && { excerpt: input.excerpt }),
      ...(input.cover_image !== undefined && { cover_image: input.cover_image }),
      ...(input.status !== undefined && { status: input.status }),
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

  const countOps = buildCategoryCountOps({
    wasPublished,
    willBePublished,
    categoryChanged,
    oldCategoryId,
    newCategoryId,
  });

  if (countOps.length > 0) {
    const [updated] = await prisma.$transaction([updateOp, ...countOps]);
    return updated;
  }

  return updateOp;
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

  const shouldDecrementCount = post.status === "PUBLISHED" && post.category_id;

  if (shouldDecrementCount) {
    await prisma.$transaction([
      prisma.post.delete({ where: { id } }),
      prisma.category.update({
        where: { id: post.category_id! },
        data: { post_count: { decrement: 1 } },
      }),
    ]);
  } else {
    await prisma.post.delete({ where: { id } });
  }
}

import { Prisma } from "@/lib/generated/prisma/client.js";

interface CategoryCountParams {
  wasPublished: boolean;
  willBePublished: boolean;
  categoryChanged: boolean;
  oldCategoryId: string | null;
  newCategoryId: string | null | undefined;
}

/**
 * 카테고리별 게시글 수 동기화를 위한 PrismaPromise 배열 생성
 *
 * 3가지 케이스:
 * - PUBLISHED → DRAFT: 기존 카테고리 -1
 * - DRAFT → PUBLISHED: 새 카테고리 +1
 * - PUBLISHED 유지 + 카테고리 변경: 이전 -1, 새 +1
 */
function buildCategoryCountOps(params: CategoryCountParams): Prisma.PrismaPromise<unknown>[] {
  const { wasPublished, willBePublished, categoryChanged, oldCategoryId, newCategoryId } = params;
  const ops: Prisma.PrismaPromise<unknown>[] = [];

  if (wasPublished && !willBePublished) {
    if (oldCategoryId) {
      ops.push(prisma.category.update({
        where: { id: oldCategoryId },
        data: { post_count: { decrement: 1 } },
      }));
    }
  } else if (!wasPublished && willBePublished) {
    if (newCategoryId) {
      ops.push(prisma.category.update({
        where: { id: newCategoryId },
        data: { post_count: { increment: 1 } },
      }));
    }
  } else if (wasPublished && willBePublished && categoryChanged) {
    if (oldCategoryId) {
      ops.push(prisma.category.update({
        where: { id: oldCategoryId },
        data: { post_count: { decrement: 1 } },
      }));
    }
    if (newCategoryId) {
      ops.push(prisma.category.update({
        where: { id: newCategoryId },
        data: { post_count: { increment: 1 } },
      }));
    }
  }

  return ops;
}
