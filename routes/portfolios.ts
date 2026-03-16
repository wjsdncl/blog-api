/**
 * Portfolios Routes
 * 포트폴리오 관리
 */
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@/lib/prismaClient.js";
import { optionalAuthenticate, requireOwner } from "@/middleware/auth.js";
import { NotFoundError } from "@/lib/errors.js";
import { portfolioIdParamsSchema, slugParamsSchema } from "@/utils/schemas.js";
import { buildStatusFilter, assertPublicAccess, incrementViewCount, buildPaginationMeta } from "@/utils/prismaHelpers.js";
import { createPortfolio, updatePortfolio, deletePortfolio, portfolioListSelect, portfolioDetailSelect } from "@/services/portfolio.service.js";
import { zodToJsonSchema } from "@/utils/zodToJsonSchema.js";

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
  end_date: z.coerce.date().nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED"]).default("DRAFT"),
  order: z.number().int().min(0).default(0),
  category_id: z.string().uuid("유효하지 않은 카테고리 ID입니다.").nullable().optional(),
  tag_ids: z.array(z.string().uuid()).max(10, "태그는 최대 10개까지 가능합니다.").optional(),
  tech_stack_ids: z.array(z.string().uuid()).max(20, "기술 스택은 최대 20개까지 가능합니다.").optional(),
  links: z.array(portfolioLinkSchema).max(10, "링크는 최대 10개까지 가능합니다.").optional(),
  published_at: z.coerce.date().optional(),
});

const updatePortfolioSchema = createPortfolioSchema.partial();

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
            data: { type: "array", items: { type: "object", additionalProperties: true } },
            pagination: { type: "object", additionalProperties: true },
          },
        },
      },
    },
    preHandler: optionalAuthenticate,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { page, limit, status, category, tag, tech } = portfolioListQuerySchema.parse(request.query);
      const skip = (page - 1) * limit;
      const isOwner = request.user?.role === "OWNER";

      const where: Record<string, unknown> = {
        ...buildStatusFilter(isOwner, status),
      };

      // 카테고리 필터
      if (category) {
        where.category = { name: category };
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

      return reply.send({
        success: true,
        data: portfolios,
        pagination: buildPaginationMeta(page, limit, total),
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
            data: { type: "object", additionalProperties: true },
          },
        },
        404: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
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
      await incrementViewCount("portfolio", portfolio.id, isOwner, request.ip);

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
            data: { type: "object", additionalProperties: true },
            message: { type: "string" },
          },
        },
        400: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        401: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        403: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
      },
    },
    preHandler: requireOwner,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const input = createPortfolioSchema.parse(request.body);
      const portfolio = await createPortfolio(input);

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
            data: { type: "object", additionalProperties: true },
            message: { type: "string" },
          },
        },
        400: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        401: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        403: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        404: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
      },
    },
    preHandler: requireOwner,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = portfolioIdParamsSchema.parse(request.params);
      const input = updatePortfolioSchema.parse(request.body);
      const updated = await updatePortfolio(id, input);

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
        401: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        403: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        404: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
      },
    },
    preHandler: requireOwner,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = portfolioIdParamsSchema.parse(request.params);
      await deletePortfolio(id);

      return reply.send({
        success: true,
        message: "포트폴리오가 삭제되었습니다.",
      });
    },
  });
};

export default portfoliosRoutes;
