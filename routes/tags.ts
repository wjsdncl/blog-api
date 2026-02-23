/**
 * Tags Routes
 * 태그 관리
 */
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@/lib/prismaClient.js";
import { requireOwner } from "@/middleware/auth.js";
import { NotFoundError } from "@/lib/errors.js";
import { generateUniqueSlug } from "@/utils/slug.js";
import { tagIdParamsSchema, slugParamsSchema } from "@/utils/schemas.js";
import { findByIdOrThrow, checkUniqueName } from "@/utils/prismaHelpers.js";
import { zodToJsonSchema } from "@/utils/zodToJsonSchema.js";

// ============================================
// Schemas
// ============================================

const createTagSchema = z.object({
  name: z.string().min(1, "태그명은 필수입니다.").max(30, "태그명은 30자 이하여야 합니다."),
});

const updateTagSchema = createTagSchema.partial();

// ============================================
// Select Objects
// ============================================

const tagSelect = {
  id: true,
  name: true,
  slug: true,
  created_at: true,
} as const;

// ============================================
// Routes
// ============================================

const tagsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /tags
   * 태그 목록 조회 (전체 게시글 수 + 각 태그별 게시글 수)
   */
  fastify.get("/", {
    schema: {
      tags: ["Tags"],
      summary: "태그 목록 조회",
      description: "모든 태그와 전체 게시글 수를 조회합니다.",
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
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const [tags, totalPostCount] = await Promise.all([
        prisma.tag.findMany({
          select: tagSelect,
          orderBy: { name: "asc" },
        }),
        prisma.post.count({
          where: { status: "PUBLISHED" },
        }),
      ]);

      return reply.send({
        success: true,
        data: tags,
        totalPostCount,
      });
    },
  });

  /**
   * GET /tags/:slug
   * 태그 상세 조회 (슬러그)
   */
  fastify.get("/:slug", {
    schema: {
      tags: ["Tags"],
      summary: "태그 상세 조회",
      description: "슬러그로 태그 상세 정보를 조회합니다.",
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
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { slug } = slugParamsSchema.parse(request.params);

      const tag = await prisma.tag.findUnique({
        where: { slug },
        select: tagSelect,
      });

      if (!tag) {
        throw new NotFoundError("태그");
      }

      return reply.send({
        success: true,
        data: tag,
      });
    },
  });

  /**
   * POST /tags
   * 태그 생성 (OWNER 전용)
   */
  fastify.post("/", {
    schema: {
      tags: ["Tags"],
      summary: "태그 생성",
      description: "새 태그를 생성합니다. OWNER 권한이 필요합니다.",
      security: [{ bearerAuth: [] }],
      body: zodToJsonSchema(createTagSchema),
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
      const input = createTagSchema.parse(request.body);

      // 이름 중복 체크
      await checkUniqueName("tag", input.name);

      // 슬러그 생성
      const slug = await generateUniqueSlug("tag", input.name);

      const tag = await prisma.tag.create({
        data: {
          name: input.name,
          slug,
        },
        select: tagSelect,
      });

      return reply.status(201).send({
        success: true,
        data: tag,
        message: "태그가 생성되었습니다.",
      });
    },
  });

  /**
   * PATCH /tags/:id
   * 태그 수정 (OWNER 전용)
   */
  fastify.patch("/:id", {
    schema: {
      tags: ["Tags"],
      summary: "태그 수정",
      description: "태그를 수정합니다. OWNER 권한이 필요합니다.",
      security: [{ bearerAuth: [] }],
      params: zodToJsonSchema(tagIdParamsSchema),
      body: zodToJsonSchema(updateTagSchema),
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
      const { id } = tagIdParamsSchema.parse(request.params);
      const input = updateTagSchema.parse(request.body);

      const tag = await findByIdOrThrow<{ id: string; name: string }>("tag", id);

      // 이름 변경 시 중복 체크 및 슬러그 재생성
      let newSlug: string | undefined;
      if (input.name && input.name !== tag.name) {
        await checkUniqueName("tag", input.name, id);
        newSlug = await generateUniqueSlug("tag", input.name, id);
      }

      const updated = await prisma.tag.update({
        where: { id },
        data: {
          ...(input.name && { name: input.name }),
          ...(newSlug && { slug: newSlug }),
        },
        select: tagSelect,
      });

      return reply.send({
        success: true,
        data: updated,
        message: "태그가 수정되었습니다.",
      });
    },
  });

  /**
   * DELETE /tags/:id
   * 태그 삭제 (OWNER 전용)
   */
  fastify.delete("/:id", {
    schema: {
      tags: ["Tags"],
      summary: "태그 삭제",
      description: "태그를 삭제합니다. OWNER 권한이 필요합니다.",
      security: [{ bearerAuth: [] }],
      params: zodToJsonSchema(tagIdParamsSchema),
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
      const { id } = tagIdParamsSchema.parse(request.params);

      await findByIdOrThrow("tag", id);

      // 태그는 게시글이 있어도 삭제 가능 (관계만 해제됨)
      await prisma.tag.delete({ where: { id } });

      return reply.send({
        success: true,
        message: "태그가 삭제되었습니다.",
      });
    },
  });
};

export default tagsRoutes;
