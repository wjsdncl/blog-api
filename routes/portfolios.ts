/**
 * Portfolios Routes
 * 포트폴리오 관리
 */
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@/lib/prismaClient.js";
import { optionalAuthenticate, requireOwner } from "@/middleware/auth.js";
import { NotFoundError, BadRequestError } from "@/lib/errors.js";
import { generateUniqueSlug } from "@/utils/slug.js";
import { portfolioIdParamsSchema, slugParamsSchema } from "@/utils/schemas.js";
import {
  findByIdOrThrow,
  addStatusFilter,
  assertPublicAccess,
  incrementViewCount,
  calculatePublishedAt,
} from "@/utils/prismaHelpers.js";
import { zodToJsonSchema } from "@/utils/zodToJsonSchema.js";

// ============================================
// Schemas
// ============================================

const portfolioListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED"]).optional(),
  category: z.string().optional(), // category slug
  tag: z.string().optional(), // tag slug
  tech: z.string().optional(), // tech stack name
});

const portfolioLinkSchema = z.object({
  type: z.string().min(1, "링크 타입은 필수입니다.").max(50),
  url: z.string().url("유효한 URL을 입력해주세요."),
  label: z.string().max(100).optional(),
  order: z.number().int().min(0).default(0),
});

const createPortfolioSchema = z.object({
  title: z.string().min(1, "제목은 필수입니다.").max(200, "제목은 200자 이하여야 합니다."),
  content: z.string().min(1, "내용은 필수입니다."),
  excerpt: z.string().max(500, "요약은 500자 이하여야 합니다.").optional(),
  cover_image: z.string().url("유효한 URL을 입력해주세요.").optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED"]).default("DRAFT"),
  order: z.number().int().min(0).default(0),
  category_id: z.string().uuid("유효하지 않은 카테고리 ID입니다.").optional().nullable(),
  tag_ids: z.array(z.string().uuid()).max(10, "태그는 최대 10개까지 가능합니다.").optional(),
  tech_stack_ids: z.array(z.string().uuid()).max(20, "기술 스택은 최대 20개까지 가능합니다.").optional(),
  links: z.array(portfolioLinkSchema).max(10, "링크는 최대 10개까지 가능합니다.").optional(),
  published_at: z.coerce.date().optional(),
});

const updatePortfolioSchema = createPortfolioSchema.partial();

// ============================================
// Select Objects
// ============================================

const portfolioListSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  cover_image: true,
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
      slug: true,
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
} as const;

const portfolioDetailSelect = {
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

// ============================================
// Routes
// ============================================

const portfoliosRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /portfolios
   * 포트폴리오 목록 조회
   */
  fastify.get("/", {
    schema: {
      tags: ["Portfolios"],
      summary: "포트폴리오 목록 조회",
      description: "포트폴리오 목록을 페이지네이션하여 조회합니다.",
      querystring: zodToJsonSchema(portfolioListQuerySchema),
      response: {
        200: {
          description: "성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "array", items: { $ref: "#/components/schemas/Portfolio" } },
            pagination: { $ref: "#/components/schemas/PaginationMeta" },
          },
        },
      },
    },
    preHandler: optionalAuthenticate,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { page, limit, status, category, tag, tech } = portfolioListQuerySchema.parse(request.query);
      const skip = (page - 1) * limit;
      const isOwner = request.user?.role === "OWNER";

      // 검색 조건
      const where: Record<string, unknown> = {};

      // 상태 필터 (OWNER만 DRAFT, SCHEDULED 조회 가능)
      addStatusFilter(where, isOwner, status);

      // 카테고리 필터
      if (category) {
        where.category = { slug: category };
      }

      // 태그 필터
      if (tag) {
        where.tags = { some: { slug: tag } };
      }

      // 기술 스택 필터
      if (tech) {
        where.techStacks = { some: { name: { equals: tech, mode: "insensitive" } } };
      }

      const [portfolios, total] = await Promise.all([
        prisma.portfolio.findMany({
          where,
          select: portfolioListSelect,
          orderBy: [{ order: "asc" }, { created_at: "desc" }],
          skip,
          take: limit,
        }),
        prisma.portfolio.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return reply.send({
        success: true,
        data: portfolios,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    },
  });

  /**
   * GET /portfolios/:slug
   * 포트폴리오 상세 조회 (슬러그)
   */
  fastify.get("/:slug", {
    schema: {
      tags: ["Portfolios"],
      summary: "포트폴리오 상세 조회",
      description: "슬러그로 포트폴리오 상세 정보를 조회합니다.",
      params: zodToJsonSchema(slugParamsSchema),
      response: {
        200: {
          description: "성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { $ref: "#/components/schemas/Portfolio" },
          },
        },
        404: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
    preHandler: optionalAuthenticate,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { slug } = slugParamsSchema.parse(request.params);
      const isOwner = request.user?.role === "OWNER";

      const portfolio = await prisma.portfolio.findUnique({
        where: { slug },
        select: portfolioDetailSelect,
      });

      if (!portfolio) {
        throw new NotFoundError("포트폴리오");
      }

      // 접근 권한 체크 (비공개/예약 발행)
      assertPublicAccess(portfolio, isOwner, "포트폴리오");

      // 조회수 증가 (OWNER가 아닌 경우)
      await incrementViewCount("portfolio", portfolio.id, isOwner);

      return reply.send({
        success: true,
        data: portfolio,
      });
    },
  });

  /**
   * POST /portfolios
   * 포트폴리오 생성 (OWNER 전용)
   */
  fastify.post("/", {
    schema: {
      tags: ["Portfolios"],
      summary: "포트폴리오 생성",
      description: "새 포트폴리오를 생성합니다. OWNER 권한이 필요합니다.",
      security: [{ bearerAuth: [] }],
      body: zodToJsonSchema(createPortfolioSchema),
      response: {
        201: {
          description: "생성 성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { $ref: "#/components/schemas/Portfolio" },
            message: { type: "string" },
          },
        },
        400: { $ref: "#/components/schemas/ErrorResponse" },
        401: { $ref: "#/components/schemas/ErrorResponse" },
        403: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
    preHandler: requireOwner,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const input = createPortfolioSchema.parse(request.body);

      // 슬러그 자동 생성
      const slug = await generateUniqueSlug("portfolio", input.title);

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
      const publishedAt = calculatePublishedAt(input.status, input.published_at);

      const portfolio = await prisma.portfolio.create({
        data: {
          title: input.title,
          slug,
          content: input.content,
          excerpt: input.excerpt,
          cover_image: input.cover_image,
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

      return reply.status(201).send({
        success: true,
        data: portfolio,
        message: "포트폴리오가 생성되었습니다.",
      });
    },
  });

  /**
   * PATCH /portfolios/:id
   * 포트폴리오 수정 (OWNER 전용)
   */
  fastify.patch("/:id", {
    schema: {
      tags: ["Portfolios"],
      summary: "포트폴리오 수정",
      description: "포트폴리오를 수정합니다. OWNER 권한이 필요합니다.",
      security: [{ bearerAuth: [] }],
      params: zodToJsonSchema(portfolioIdParamsSchema),
      body: zodToJsonSchema(updatePortfolioSchema),
      response: {
        200: {
          description: "수정 성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { $ref: "#/components/schemas/Portfolio" },
            message: { type: "string" },
          },
        },
        400: { $ref: "#/components/schemas/ErrorResponse" },
        401: { $ref: "#/components/schemas/ErrorResponse" },
        403: { $ref: "#/components/schemas/ErrorResponse" },
        404: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
    preHandler: requireOwner,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = portfolioIdParamsSchema.parse(request.params);
      const input = updatePortfolioSchema.parse(request.body);

      const portfolio = await findByIdOrThrow<{ id: string; title: string; status: string }>(
        "portfolio",
        id
      );

      // 제목 변경 시 슬러그 재생성
      let newSlug: string | undefined;
      if (input.title && input.title !== portfolio.title) {
        newSlug = await generateUniqueSlug("portfolio", input.title, id);
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
      const publishedAt = calculatePublishedAt(input.status, input.published_at, portfolio.status);

      // 링크 업데이트 (전체 교체)
      if (input.links !== undefined) {
        // 기존 링크 삭제
        await prisma.portfolioLink.deleteMany({
          where: { portfolio_id: id },
        });
      }

      const updated = await prisma.portfolio.update({
        where: { id },
        data: {
          ...(input.title && { title: input.title }),
          ...(newSlug && { slug: newSlug }),
          ...(input.content && { content: input.content }),
          ...(input.excerpt !== undefined && { excerpt: input.excerpt }),
          ...(input.cover_image !== undefined && { cover_image: input.cover_image }),
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

      return reply.send({
        success: true,
        data: updated,
        message: "포트폴리오가 수정되었습니다.",
      });
    },
  });

  /**
   * DELETE /portfolios/:id
   * 포트폴리오 삭제 (OWNER 전용)
   */
  fastify.delete("/:id", {
    schema: {
      tags: ["Portfolios"],
      summary: "포트폴리오 삭제",
      description: "포트폴리오를 삭제합니다. OWNER 권한이 필요합니다.",
      security: [{ bearerAuth: [] }],
      params: zodToJsonSchema(portfolioIdParamsSchema),
      response: {
        200: {
          description: "삭제 성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
          },
        },
        401: { $ref: "#/components/schemas/ErrorResponse" },
        403: { $ref: "#/components/schemas/ErrorResponse" },
        404: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
    preHandler: requireOwner,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = portfolioIdParamsSchema.parse(request.params);

      await findByIdOrThrow("portfolio", id);

      // 포트폴리오 삭제 (CASCADE로 링크도 함께 삭제됨)
      await prisma.portfolio.delete({ where: { id } });

      return reply.send({
        success: true,
        message: "포트폴리오가 삭제되었습니다.",
      });
    },
  });
};

export default portfoliosRoutes;
