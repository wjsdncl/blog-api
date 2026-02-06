/**
 * Comments Routes
 * 댓글 관리
 */
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@/lib/prismaClient.js";
import { optionalAuthenticate, requiredAuthenticate } from "@/middleware/auth.js";
import { NotFoundError } from "@/lib/errors.js";
import { commentIdParamsSchema } from "@/utils/schemas.js";
import { toggleLike } from "@/services/like.service.js";
import {
  createComment,
  updateComment,
  deleteComment,
  commentSelect,
} from "@/services/comment.service.js";
import { zodToJsonSchema } from "@/utils/zodToJsonSchema.js";

// ============================================
// Schemas
// ============================================

const commentListQuerySchema = z.object({
  post_id: z.string().uuid("유효하지 않은 게시글 ID입니다."),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const createCommentSchema = z.object({
  post_id: z.string().uuid("유효하지 않은 게시글 ID입니다."),
  content: z.string().min(1, "댓글 내용은 필수입니다.").max(2000, "댓글은 2000자 이하여야 합니다."),
  parent_id: z.string().uuid("유효하지 않은 부모 댓글 ID입니다.").optional(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1, "댓글 내용은 필수입니다.").max(2000, "댓글은 2000자 이하여야 합니다."),
});

// ============================================
// Select Objects (답글 포함)
// ============================================

const commentWithRepliesSelect = {
  ...commentSelect,
  replies: {
    where: { deleted_at: null },
    select: {
      ...commentSelect,
      _count: {
        select: {
          commentLikes: true,
        },
      },
    },
    orderBy: { created_at: "asc" as const },
  },
  _count: {
    select: {
      commentLikes: true,
    },
  },
} as const;

// ============================================
// Routes
// ============================================

const commentsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /comments?post_id=xxx
   * 게시글의 댓글 목록 조회 (답글 포함)
   */
  fastify.get("/", {
    schema: {
      tags: ["Comments"],
      summary: "댓글 목록 조회",
      description: "게시글의 댓글 목록을 조회합니다. 답글도 함께 조회됩니다.",
      querystring: zodToJsonSchema(commentListQuerySchema),
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
        404: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
      },
    },
    preHandler: optionalAuthenticate,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { post_id, page, limit } = commentListQuerySchema.parse(request.query);
      const skip = (page - 1) * limit;

      // 게시글 존재 확인
      const post = await prisma.post.findUnique({
        where: { id: post_id },
        select: { id: true, status: true },
      });

      if (!post) {
        throw new NotFoundError("게시글");
      }

      // 비공개 게시글의 댓글은 OWNER만 조회 가능
      const isOwner = request.user?.role === "OWNER";
      if (post.status !== "PUBLISHED" && !isOwner) {
        throw new NotFoundError("게시글");
      }

      const whereCondition = {
        post_id,
        parent_id: null,
        deleted_at: null,
      };

      const [comments, total] = await Promise.all([
        prisma.comment.findMany({
          where: whereCondition,
          select: commentWithRepliesSelect,
          orderBy: { created_at: "desc" },
          skip,
          take: limit,
        }),
        prisma.comment.count({ where: whereCondition }),
      ]);

      // 사용자별 좋아요 여부 추가
      let userLikedCommentIds: Set<string> = new Set();
      if (request.user) {
        const userLikes = await prisma.commentLike.findMany({
          where: {
            user_id: request.user.userId,
            comment_id: {
              in: [
                ...comments.map((c) => c.id),
                ...comments.flatMap((c) => c.replies.map((r) => r.id)),
              ],
            },
          },
          select: { comment_id: true },
        });
        userLikedCommentIds = new Set(userLikes.map((l) => l.comment_id));
      }

      // 응답 데이터 가공
      const data = comments.map((comment) => ({
        ...comment,
        like_count: comment._count.commentLikes,
        is_liked: userLikedCommentIds.has(comment.id),
        _count: undefined,
        replies: comment.replies.map((reply) => ({
          ...reply,
          like_count: reply._count.commentLikes,
          is_liked: userLikedCommentIds.has(reply.id),
          _count: undefined,
        })),
      }));

      const totalPages = Math.ceil(total / limit);

      return reply.send({
        success: true,
        data,
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
   * POST /comments
   * 댓글 작성 (로그인 필수)
   */
  fastify.post("/", {
    schema: {
      tags: ["Comments"],
      summary: "댓글 작성",
      description: "게시글에 댓글을 작성합니다. 로그인이 필요합니다.",
      security: [{ bearerAuth: [] }],
      body: zodToJsonSchema(createCommentSchema),
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
        404: { type: "object", properties: { success: { type: "boolean" }, error: { type: "string" } } },
      },
    },
    preHandler: requiredAuthenticate,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const input = createCommentSchema.parse(request.body);
      const userId = request.user!.userId;
      const isOwner = request.user!.role === "OWNER";

      const comment = await createComment(input, userId, isOwner);

      return reply.status(201).send({
        success: true,
        data: comment,
        message: "댓글이 작성되었습니다.",
      });
    },
  });

  /**
   * PATCH /comments/:id
   * 댓글 수정 (작성자만)
   */
  fastify.patch("/:id", {
    schema: {
      tags: ["Comments"],
      summary: "댓글 수정",
      description: "댓글을 수정합니다. 작성자만 수정할 수 있습니다.",
      security: [{ bearerAuth: [] }],
      params: zodToJsonSchema(commentIdParamsSchema),
      body: zodToJsonSchema(updateCommentSchema),
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
      },
    },
    preHandler: requiredAuthenticate,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = commentIdParamsSchema.parse(request.params);
      const { content } = updateCommentSchema.parse(request.body);
      const userId = request.user!.userId;

      const comment = await updateComment(id, content, userId);

      return reply.send({
        success: true,
        data: comment,
        message: "댓글이 수정되었습니다.",
      });
    },
  });

  /**
   * DELETE /comments/:id
   * 댓글 삭제 (작성자 또는 OWNER)
   */
  fastify.delete("/:id", {
    schema: {
      tags: ["Comments"],
      summary: "댓글 삭제",
      description: "댓글을 삭제합니다. 작성자 또는 OWNER만 삭제할 수 있습니다.",
      security: [{ bearerAuth: [] }],
      params: zodToJsonSchema(commentIdParamsSchema),
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
    preHandler: requiredAuthenticate,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = commentIdParamsSchema.parse(request.params);
      const userId = request.user!.userId;
      const isOwner = request.user!.role === "OWNER";

      await deleteComment(id, userId, isOwner);

      return reply.send({
        success: true,
        message: "댓글이 삭제되었습니다.",
      });
    },
  });

  /**
   * POST /comments/:id/like
   * 댓글 좋아요/취소 (로그인 필수)
   */
  fastify.post("/:id/like", {
    schema: {
      tags: ["Comments"],
      summary: "댓글 좋아요/취소",
      description: "댓글에 좋아요를 추가하거나 취소합니다. 로그인이 필요합니다.",
      security: [{ bearerAuth: [] }],
      params: zodToJsonSchema(commentIdParamsSchema),
      response: {
        200: {
          description: "성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                is_liked: { type: "boolean" },
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
      const { id } = commentIdParamsSchema.parse(request.params);
      const userId = request.user!.userId;

      const result = await toggleLike("comment", id, userId);

      return reply.send({
        success: true,
        data: { is_liked: result.isLiked },
        message: result.message,
      });
    },
  });
};

export default commentsRoutes;
