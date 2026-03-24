/**
 * 포트폴리오 서비스
 *
 * 포트폴리오 CUD 비즈니스 로직 담당.
 * 슬러그 자동 생성, 카테고리 검증, 발행일 계산, 링크 교체 처리.
 */
import { prisma } from "@/lib/prismaClient.js";
import { NotFoundError } from "@/lib/errors.js";
import { generateUniqueSlug } from "@/utils/slug.js";
import { calculatePublishedAt, validateCategoryId } from "@/utils/prismaHelpers.js";

export interface CreatePortfolioInput {
  title: string;
  content: string;
  excerpt?: string;
  summary?: string[];
  start_date?: Date;
  end_date?: Date | null;
  status: "DRAFT" | "PUBLISHED" | "SCHEDULED";
  order: number;
  category_id?: string | null;
  tag_ids?: string[];
  tech_stack_ids?: string[];
  images?: { url: string; order: number }[];
  links?: { type: string; url: string; label?: string; order: number }[];
  published_at?: Date;
}

export interface UpdatePortfolioInput {
  title?: string;
  content?: string;
  excerpt?: string;
  summary?: string[];
  start_date?: Date;
  end_date?: Date | null;
  status?: "DRAFT" | "PUBLISHED" | "SCHEDULED";
  order?: number;
  category_id?: string | null;
  tag_ids?: string[];
  tech_stack_ids?: string[];
  images?: { url: string; order: number }[];
  links?: { type: string; url: string; label?: string; order: number }[];
  published_at?: Date;
}

export const portfolioListSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  summary: true,
  start_date: true,
  end_date: true,
  status: true,
  view_count: true,
  order: true,
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
  techStacks: {
    select: {
      id: true,
      name: true,
      category: true,
    },
  },
  images: {
    select: {
      id: true,
      url: true,
      order: true,
    },
    orderBy: { order: "asc" as const },
  },
} as const;

export const portfolioDetailSelect = {
  ...portfolioListSelect,
  content: true,
  updated_at: true,
  links: {
    select: {
      id: true,
      type: true,
      url: true,
      label: true,
      order: true,
    },
    orderBy: { order: "asc" as const },
  },
} as const;

/**
 * 포트폴리오 생성
 * - 슬러그 자동 생성
 * - 카테고리 존재 검증
 * - PUBLISHED 상태 시 발행일 자동 설정
 */
export async function createPortfolio(input: CreatePortfolioInput) {
  const slug = await generateUniqueSlug("portfolio", input.title);
  await validateCategoryId(input.category_id);

  const publishedAt = calculatePublishedAt(input.status, input.published_at);

  return prisma.portfolio.create({
    data: {
      title: input.title,
      slug,
      content: input.content,
      excerpt: input.excerpt,
      summary: input.summary ?? [],
      start_date: input.start_date,
      end_date: input.end_date,
      status: input.status,
      order: input.order,
      category_id: input.category_id,
      published_at: publishedAt,
      ...(input.tag_ids && {
        tags: {
          connect: input.tag_ids.map((id) => ({ id })),
        },
      }),
      ...(input.tech_stack_ids && {
        techStacks: {
          connect: input.tech_stack_ids.map((id) => ({ id })),
        },
      }),
      ...(input.images && {
        images: {
          create: input.images.map((img, index) => ({
            url: img.url,
            order: img.order ?? index,
          })),
        },
      }),
      ...(input.links && {
        links: {
          create: input.links.map((link, index) => ({
            type: link.type,
            url: link.url,
            label: link.label,
            order: link.order ?? index,
          })),
        },
      }),
    },
    select: portfolioDetailSelect,
  });
}

/**
 * 포트폴리오 수정
 * - 제목 변경 시 슬러그 재생성
 * - 링크는 전체 교체 방식
 */
export async function updatePortfolio(id: string, input: UpdatePortfolioInput) {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id },
    select: { id: true, title: true, status: true },
  });

  if (!portfolio) {
    throw new NotFoundError("포트폴리오");
  }

  let newSlug: string | undefined;
  if (input.title && input.title !== portfolio.title) {
    newSlug = await generateUniqueSlug("portfolio", input.title, id);
  }

  await validateCategoryId(input.category_id);

  const publishedAt = calculatePublishedAt(input.status, input.published_at, portfolio.status);

  const updateData = {
    ...(input.title && { title: input.title }),
    ...(newSlug && { slug: newSlug }),
    ...(input.content && { content: input.content }),
    ...(input.excerpt !== undefined && { excerpt: input.excerpt }),
    ...(input.summary !== undefined && { summary: input.summary }),
    ...(input.start_date !== undefined && { start_date: input.start_date }),
    ...(input.end_date !== undefined && { end_date: input.end_date }),
    ...(input.status && { status: input.status }),
    ...(input.order !== undefined && { order: input.order }),
    ...(input.category_id !== undefined && { category_id: input.category_id }),
    ...(publishedAt && { published_at: publishedAt }),
    ...(input.tag_ids && {
      tags: {
        set: input.tag_ids.map((tagId) => ({ id: tagId })),
      },
    }),
    ...(input.tech_stack_ids && {
      techStacks: {
        set: input.tech_stack_ids.map((techId) => ({ id: techId })),
      },
    }),
    ...(input.images && {
      images: {
        create: input.images.map((img, index) => ({
          url: img.url,
          order: img.order ?? index,
        })),
      },
    }),
    ...(input.links && {
      links: {
        create: input.links.map((link, index) => ({
          type: link.type,
          url: link.url,
          label: link.label,
          order: link.order ?? index,
        })),
      },
    }),
  };

  const needsTransaction = input.images !== undefined || input.links !== undefined;

  if (needsTransaction) {
    const deleteOps = [
      ...(input.images !== undefined ? [prisma.portfolioImage.deleteMany({ where: { portfolio_id: id } })] : []),
      ...(input.links !== undefined ? [prisma.portfolioLink.deleteMany({ where: { portfolio_id: id } })] : []),
    ];

    const results = await prisma.$transaction([
      ...deleteOps,
      prisma.portfolio.update({ where: { id }, data: updateData, select: portfolioDetailSelect }),
    ]);
    return results[results.length - 1];
  }

  return prisma.portfolio.update({
    where: { id },
    data: updateData,
    select: portfolioDetailSelect,
  });
}

/**
 * 포트폴리오 삭제
 * CASCADE로 링크도 함께 삭제됨
 */
export async function deletePortfolio(id: string) {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!portfolio) {
    throw new NotFoundError("포트폴리오");
  }

  await prisma.portfolio.delete({ where: { id } });
}
