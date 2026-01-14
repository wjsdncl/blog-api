/**
 * Tech Stacks Routes
 * 기술 스택 관리
 */
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@/lib/prismaClient.js";
import { requireOwner } from "@/middleware/auth.js";
import { techStackIdParamsSchema } from "@/utils/schemas.js";
import { findByIdOrThrow, checkUniqueName } from "@/utils/prismaHelpers.js";
import { zodToJsonSchema } from "@/utils/zodToJsonSchema.js";

// ============================================
// Schemas
// ============================================

const createTechStackSchema = z.object({
  name: z.string().min(1, "기술명은 필수입니다.").max(50, "기술명은 50자 이하여야 합니다."),
  category: z.string().max(50, "카테고리는 50자 이하여야 합니다.").optional(),
});

const updateTechStackSchema = createTechStackSchema.partial();

// ============================================
// Select Objects
// ============================================

const techStackSelect = {
  id: true,
  name: true,
  category: true,
  created_at: true,
} as const;

const techStackWithCountSelect = {
  ...techStackSelect,
  _count: {
    select: {
      portfolios: true,
    },
  },
} as const;

// ============================================
// Routes
// ============================================

const techStacksRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /tech-stacks
   * 기술 스택 목록 조회
   */
  fastify.get("/", {
    schema: {
      tags: ["TechStacks"],
      summary: "기술 스택 목록 조회",
      description: "모든 기술 스택을 조회합니다. 카테고리별 그룹화된 목록도 함께 반환됩니다.",
      response: {
        200: {
          description: "성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                items: { type: "array", items: { type: "object" } },
                grouped: { type: "object" },
              },
            },
          },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const techStacks = await prisma.techStack.findMany({
        select: techStackWithCountSelect,
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });

      // 카테고리별 그룹화
      const grouped = techStacks.reduce((acc, tech) => {
        const category = tech.category || "기타";
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push({
          ...tech,
          portfolio_count: tech._count.portfolios,
          _count: undefined,
        });
        return acc;
      }, {} as Record<string, unknown[]>);

      return reply.send({
        success: true,
        data: {
          items: techStacks.map((tech) => ({
            ...tech,
            portfolio_count: tech._count.portfolios,
            _count: undefined,
          })),
          grouped,
        },
      });
    },
  });

  /**
   * GET /tech-stacks/:id
   * 기술 스택 상세 조회
   */
  fastify.get("/:id", {
    schema: {
      tags: ["TechStacks"],
      summary: "기술 스택 상세 조회",
      description: "ID로 기술 스택 상세 정보를 조회합니다.",
      params: zodToJsonSchema(techStackIdParamsSchema),
      response: {
        200: {
          description: "성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "object" },
          },
        },
        404: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = techStackIdParamsSchema.parse(request.params);

      const techStack = await findByIdOrThrow<{
        id: string;
        name: string;
        category: string | null;
        created_at: Date;
        _count: { portfolios: number };
      }>("techStack", id, techStackWithCountSelect);

      return reply.send({
        success: true,
        data: {
          ...techStack,
          portfolio_count: techStack._count.portfolios,
          _count: undefined,
        },
      });
    },
  });

  /**
   * POST /tech-stacks
   * 기술 스택 생성 (OWNER 전용)
   */
  fastify.post("/", {
    schema: {
      tags: ["TechStacks"],
      summary: "기술 스택 생성",
      description: "새 기술 스택을 생성합니다. OWNER 권한이 필요합니다.",
      security: [{ bearerAuth: [] }],
      body: zodToJsonSchema(createTechStackSchema),
      response: {
        201: {
          description: "생성 성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "object" },
            message: { type: "string" },
          },
        },
        400: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        401: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        403: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        409: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
      },
    },
    preHandler: requireOwner,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const input = createTechStackSchema.parse(request.body);

      // 이름 중복 체크
      await checkUniqueName("techStack", input.name);

      const techStack = await prisma.techStack.create({
        data: {
          name: input.name,
          category: input.category,
        },
        select: techStackSelect,
      });

      return reply.status(201).send({
        success: true,
        data: techStack,
        message: "기술 스택이 생성되었습니다.",
      });
    },
  });

  /**
   * PATCH /tech-stacks/:id
   * 기술 스택 수정 (OWNER 전용)
   */
  fastify.patch("/:id", {
    schema: {
      tags: ["TechStacks"],
      summary: "기술 스택 수정",
      description: "기술 스택을 수정합니다. OWNER 권한이 필요합니다.",
      security: [{ bearerAuth: [] }],
      params: zodToJsonSchema(techStackIdParamsSchema),
      body: zodToJsonSchema(updateTechStackSchema),
      response: {
        200: {
          description: "수정 성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "object" },
            message: { type: "string" },
          },
        },
        401: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        403: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        404: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        409: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
      },
    },
    preHandler: requireOwner,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = techStackIdParamsSchema.parse(request.params);
      const input = updateTechStackSchema.parse(request.body);

      const techStack = await findByIdOrThrow<{ id: string; name: string }>("techStack", id);

      // 이름 변경 시 중복 체크
      if (input.name && input.name !== techStack.name) {
        await checkUniqueName("techStack", input.name, id);
      }

      const updated = await prisma.techStack.update({
        where: { id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.category !== undefined && { category: input.category }),
        },
        select: techStackSelect,
      });

      return reply.send({
        success: true,
        data: updated,
        message: "기술 스택이 수정되었습니다.",
      });
    },
  });

  /**
   * DELETE /tech-stacks/:id
   * 기술 스택 삭제 (OWNER 전용)
   */
  fastify.delete("/:id", {
    schema: {
      tags: ["TechStacks"],
      summary: "기술 스택 삭제",
      description: "기술 스택을 삭제합니다. OWNER 권한이 필요합니다.",
      security: [{ bearerAuth: [] }],
      params: zodToJsonSchema(techStackIdParamsSchema),
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
      const { id } = techStackIdParamsSchema.parse(request.params);

      await findByIdOrThrow("techStack", id);

      // 기술 스택은 포트폴리오가 있어도 삭제 가능 (관계만 해제됨)
      await prisma.techStack.delete({ where: { id } });

      return reply.send({
        success: true,
        message: "기술 스택이 삭제되었습니다.",
      });
    },
  });
};

export default techStacksRoutes;
