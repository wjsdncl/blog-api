/**
 * 게시글 서비스
 *
 * Category.post_count는 DB 트리거(count_triggers.sql)가 자동 동기화.
 * 서비스 레이어에서 수동 증감하면 이중 카운트가 발생하므로 여기선 건드리지 않는다.
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
 */
export async function createPost(input: CreatePostInput) {
  const slug = await generateUniqueSlug("post", input.title);

  await validateCategoryId(input.category_id);

  let publishedAt = input.published_at;
  if (input.status === "PUBLISHED" && !publishedAt) {
    publishedAt = new Date();
  }

  return prisma.post.create({
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
}

/**
 * 게시글 수정
 * - 제목 변경 시 슬러그 재생성
 */
export async function updatePost(id: string, input: UpdatePostInput) {
  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
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

  return prisma.post.update({
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
}

/**
 * 게시글 삭제
 */
export async function deletePost(id: string) {
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!post) {
    throw new NotFoundError("게시글");
  }

  await prisma.post.delete({ where: { id } });
}
