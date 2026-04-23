/**
 * Categories Routes
 * 카테고리 관리
 */
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@/lib/prismaClient.js";
import { optionalAuthenticate, requireOwner } from "@/middleware/auth.js";
import { NotFoundError, ConflictError } from "@/lib/errors.js";
import { categoryIdParamsSchema } from "@/utils/schemas.js";
import { findByIdOrThrow, checkUniqueName, buildStatusFilter } from "@/utils/prismaHelpers.js";
import { zodToJsonSchema } from "@/utils/zodToJsonSchema.js";


const createCategorySchema = z.object({
  name: z.string().min(1, "카테고리명은 필수입니다.").max(50, "카테고리명은 50자 이하여야 합니다."),
  order: z.number().int().min(0).default(0),
});

const updateCategorySchema = createCategorySchema.partial();


const categorySelect = {
  id: true,
  name: true,
  order: true,
  post_count: true,
  created_at: true,
} as const;


const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /categories
   * 카테고리 목록 조회 (전체 게시글 수 + 각 카테고리별 게시글 수)
   *
   * OWNER는 모든 상태(DRAFT/PUBLISHED/SCHEDULED)의 게시글을 카운트에 포함.
   * 일반 사용자는 공개된(PUBLISHED + 발행일 도래) 게시글만 카운트.
   */
  fastify.get("/", {
    schema: {
      tags: ["Categories"],
      summary: "카테고리 목록 조회",
      description: "모든 카테고리와 전체 게시글 수를 조회합니다. 권한에 따라 비공개 게시글 포함 여부가 달라집니다.",
      response: {
        200: {
          description: "성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "array", items: { type: "object", additionalProperties: true } },
            totalPostCount: { type: "integer", description: "전체 게시글 수" },
          },
        },
      },
    },
    preHandler: optionalAuthenticate,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const isOwner = request.user?.role === "OWNER";
      const statusFilter = buildStatusFilter(isOwner);

      const [categories, totalPostCount, countGroups] = await Promise.all([
        prisma.category.findMany({
          select: { id: true, name: true, order: true, created_at: true },
          orderBy: [{ order: "asc" }, { name: "asc" }],
        }),
        prisma.post.count({ where: statusFilter }),
        prisma.post.groupBy({
          by: ["category_id"],
          where: statusFilter,
          _count: { _all: true },
        }),
      ]);

      const countMap = new Map<string, number>();
      for (const group of countGroups) {
        if (group.category_id) {
          countMap.set(group.category_id, group._count._all);
        }
      }

      const data = categories.map((category) => ({
        ...category,
        post_count: countMap.get(category.id) ?? 0,
      }));

      return reply.send({
        success: true,
        data,
        totalPostCount,
      });
    },
  });

  /**
   * GET /categories/:id
   * 카테고리 상세 조회 (ID)
   */
  fastify.get("/:id", {
    schema: {
      tags: ["Categories"],
      summary: "카테고리 상세 조회",
      description: "ID로 카테고리 상세 정보를 조회합니다.",
      params: zodToJsonSchema(categoryIdParamsSchema),
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
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = categoryIdParamsSchema.parse(request.params);

      const category = await prisma.category.findUnique({
        where: { id },
        select: categorySelect,
      });

      if (!category) {
        throw new NotFoundError("카테고리");
      }

      return reply.send({
        success: true,
        data: category,
      });
    },
  });

  /**
   * POST /categories
   * 카테고리 생성 (OWNER 전용)
   */
  fastify.post("/", {
    schema: {
      tags: ["Categories"],
      summary: "카테고리 생성",
      description: "새 카테고리를 생성합니다. OWNER 권한이 필요합니다.",
      security: [{ bearerAuth: [] }],
      body: zodToJsonSchema(createCategorySchema),
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
        409: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
      },
    },
    preHandler: requireOwner,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const input = createCategorySchema.parse(request.body);

      await checkUniqueName("category", input.name);

      const category = await prisma.category.create({
        data: {
          name: input.name,
          order: input.order,
        },
        select: categorySelect,
      });

      return reply.status(201).send({
        success: true,
        data: category,
        message: "카테고리가 생성되었습니다.",
      });
    },
  });

  /**
   * PATCH /categories/:id
   * 카테고리 수정 (OWNER 전용)
   */
  fastify.patch("/:id", {
    schema: {
      tags: ["Categories"],
      summary: "카테고리 수정",
      description: "카테고리를 수정합니다. OWNER 권한이 필요합니다.",
      security: [{ bearerAuth: [] }],
      params: zodToJsonSchema(categoryIdParamsSchema),
      body: zodToJsonSchema(updateCategorySchema),
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
        401: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        403: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        404: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        409: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
      },
    },
    preHandler: requireOwner,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = categoryIdParamsSchema.parse(request.params);
      const input = updateCategorySchema.parse(request.body);

      const category = await findByIdOrThrow<{ id: string; name: string }>("category", id);

      // 이름 변경 시 중복 체크
      if (input.name && input.name !== category.name) {
        await checkUniqueName("category", input.name, id);
      }

      const updated = await prisma.category.update({
        where: { id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.order !== undefined && { order: input.order }),
        },
        select: categorySelect,
      });

      return reply.send({
        success: true,
        data: updated,
        message: "카테고리가 수정되었습니다.",
      });
    },
  });

  /**
   * DELETE /categories/:id
   * 카테고리 삭제 (OWNER 전용)
   */
  fastify.delete("/:id", {
    schema: {
      tags: ["Categories"],
      summary: "카테고리 삭제",
      description:
        "카테고리를 삭제합니다. OWNER 권한이 필요합니다. 게시글이 있는 카테고리는 삭제할 수 없습니다.",
      security: [{ bearerAuth: [] }],
      params: zodToJsonSchema(categoryIdParamsSchema),
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
        409: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
      },
    },
    preHandler: requireOwner,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = categoryIdParamsSchema.parse(request.params);

      await findByIdOrThrow<{ id: string }>("category", id, { id: true });

      // 게시글이 있는 카테고리는 삭제 불가 (status 무관, 실시간 집계)
      const postCount = await prisma.post.count({ where: { category_id: id } });

      if (postCount > 0) {
        throw new ConflictError(
          `이 카테고리에 ${postCount}개의 게시글이 있습니다. 게시글을 먼저 이동하거나 삭제해주세요.`,
        );
      }

      await prisma.category.delete({ where: { id } });

      return reply.send({
        success: true,
        message: "카테고리가 삭제되었습니다.",
      });
    },
  });
};

export default categoriesRoutes;
