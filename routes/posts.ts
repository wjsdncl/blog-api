/**
 * Posts Routes
 * 블로그 게시글 관리
 */
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@/lib/prismaClient.js";
import { optionalAuthenticate, requiredAuthenticate, requireOwner } from "@/middleware/auth.js";
import { NotFoundError } from "@/lib/errors.js";
import { postIdParamsSchema, slugParamsSchema } from "@/utils/schemas.js";
import { addStatusFilter, assertPublicAccess, incrementViewCount } from "@/utils/prismaHelpers.js";
import { toggleLike } from "@/services/like.service.js";
import { createPost, updatePost, deletePost, postDetailSelect } from "@/services/post.service.js";
import { zodToJsonSchema } from "@/utils/zodToJsonSchema.js";

// ============================================
// Schemas
// ============================================

const postListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED"]).optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().max(100).optional(),
});

const createPostSchema = z.object({
  title: z.string().min(1, "제목은 필수입니다.").max(200, "제목은 200자 이하여야 합니다."),
  content: z.string().min(1, "내용은 필수입니다."),
  excerpt: z.string().max(500, "요약은 500자 이하여야 합니다.").optional(),
  cover_image: z.string().url("유효한 URL을 입력해주세요.").optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED"]).default("DRAFT"),
  category_id: z.string().uuid("유효하지 않은 카테고리 ID입니다.").optional().nullable(),
  tag_ids: z.array(z.string().uuid()).max(10, "태그는 최대 10개까지 가능합니다.").optional(),
  published_at: z.coerce.date().optional(),
});

const updatePostSchema = createPostSchema.partial();

// ============================================
// Select Objects (목록용)
// ============================================

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

// ============================================
// Routes
// ============================================

const postsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /posts
   * 게시글 목록 조회
   */
  fastify.get("/", {
    schema: {
      tags: ["Posts"],
      summary: "게시글 목록 조회",
      description:
        "게시글 목록을 페이지네이션하여 조회합니다. 카테고리, 태그, 검색어로 필터링할 수 있습니다.",
      querystring: zodToJsonSchema(postListQuerySchema),
      response: {
        200: {
          description: "성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "array", items: { type: "object" } },
            pagination: { type: "object" },
          },
        },
      },
    },
    preHandler: optionalAuthenticate,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { page, limit, status, category, tag, search } = postListQuerySchema.parse(request.query);
      const skip = (page - 1) * limit;
      const isOwner = request.user?.role === "OWNER";

      const where: Record<string, unknown> = {};

      addStatusFilter(where, isOwner, status);

      if (category) {
        where.category = { name: category };
      }

      if (tag) {
        where.tags = { some: { slug: tag } };
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { content: { contains: search, mode: "insensitive" } },
        ];
      }

      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          where,
          select: postListSelect,
          orderBy: { created_at: "desc" },
          skip,
          take: limit,
        }),
        prisma.post.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return reply.send({
        success: true,
        data: posts,
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
   * GET /posts/:slug
   * 게시글 상세 조회 (슬러그)
   */
  fastify.get("/:slug", {
    schema: {
      tags: ["Posts"],
      summary: "게시글 상세 조회",
      description: "슬러그로 게시글 상세 정보를 조회합니다.",
      params: zodToJsonSchema(slugParamsSchema),
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
    preHandler: optionalAuthenticate,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { slug } = slugParamsSchema.parse(request.params);
      const isOwner = request.user?.role === "OWNER";

      const post = await prisma.post.findUnique({
        where: { slug },
        select: {
          ...postDetailSelect,
          postLikes: request.user
            ? {
                where: { user_id: request.user.userId },
                select: { id: true },
              }
            : false,
        },
      });

      if (!post) {
        throw new NotFoundError("게시글");
      }

      assertPublicAccess(post, isOwner, "게시글");
      await incrementViewCount("post", post.id, isOwner, request.ip);

      const isLiked = request.user && Array.isArray(post.postLikes) && post.postLikes.length > 0;

      return reply.send({
        success: true,
        data: {
          ...post,
          postLikes: undefined,
          isLiked,
        },
      });
    },
  });

  /**
   * POST /posts
   * 게시글 작성 (OWNER 전용)
   */
  fastify.post("/", {
    schema: {
      tags: ["Posts"],
      summary: "게시글 작성",
      description: "새 게시글을 작성합니다. OWNER 권한이 필요합니다.",
      security: [{ bearerAuth: [] }],
      body: zodToJsonSchema(createPostSchema),
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
        401: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        403: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
      },
    },
    preHandler: requireOwner,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const input = createPostSchema.parse(request.body);
      const post = await createPost(input);

      return reply.status(201).send({
        success: true,
        data: post,
        message: "게시글이 작성되었습니다.",
      });
    },
  });

  /**
   * PATCH /posts/:id
   * 게시글 수정 (OWNER 전용)
   */
  fastify.patch("/:id", {
    schema: {
      tags: ["Posts"],
      summary: "게시글 수정",
      description: "게시글을 수정합니다. OWNER 권한이 필요합니다.",
      security: [{ bearerAuth: [] }],
      params: zodToJsonSchema(postIdParamsSchema),
      body: zodToJsonSchema(updatePostSchema),
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
        404: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
      },
    },
    preHandler: requireOwner,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = postIdParamsSchema.parse(request.params);
      const input = updatePostSchema.parse(request.body);
      const post = await updatePost(id, input);

      return reply.send({
        success: true,
        data: post,
        message: "게시글이 수정되었습니다.",
      });
    },
  });

  /**
   * DELETE /posts/:id
   * 게시글 삭제 (OWNER 전용)
   */
  fastify.delete("/:id", {
    schema: {
      tags: ["Posts"],
      summary: "게시글 삭제",
      description: "게시글을 삭제합니다. OWNER 권한이 필요합니다.",
      security: [{ bearerAuth: [] }],
      params: zodToJsonSchema(postIdParamsSchema),
      response: {
        200: {
          description: "삭제 성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
          },
        },
        404: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
      },
    },
    preHandler: requireOwner,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = postIdParamsSchema.parse(request.params);
      await deletePost(id);

      return reply.send({
        success: true,
        message: "게시글이 삭제되었습니다.",
      });
    },
  });

  /**
   * POST /posts/:id/like
   * 게시글 좋아요/취소 (로그인 필수)
   */
  fastify.post("/:id/like", {
    schema: {
      tags: ["Posts"],
      summary: "게시글 좋아요/취소",
      description: "게시글에 좋아요를 추가하거나 취소합니다. 로그인이 필요합니다.",
      security: [{ bearerAuth: [] }],
      params: zodToJsonSchema(postIdParamsSchema),
      response: {
        200: {
          description: "성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                isLiked: { type: "boolean" },
              },
            },
            message: { type: "string" },
          },
        },
        401: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
        404: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
      },
    },
    preHandler: requiredAuthenticate,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = postIdParamsSchema.parse(request.params);
      const userId = request.user!.userId;

      const result = await toggleLike("post", id, userId);

      return reply.send({
        success: true,
        data: { isLiked: result.isLiked },
        message: result.message,
      });
    },
  });
};

export default postsRoutes;
