import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prismaClient.js";
import { requiredAuthenticate, optionalAuthenticate } from "../middleware/auth.js";

const commentsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /comments - 댓글 목록 조회
  const getCommentsQuerySchema = z.object({
    postId: z.string().uuid(),
    offset: z.string().optional().default("0"),
    limit: z.string().optional().default("20"),
  });

  fastify.get(
    "/",
    { preHandler: optionalAuthenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { postId, offset, limit } = getCommentsQuerySchema.parse(request.query);

      const [totalCount, comments] = await Promise.all([
        prisma.comment.count({
          where: {
            post_id: postId,
            is_deleted: false,
          },
        }),
        prisma.comment.findMany({
          where: {
            post_id: postId,
            is_deleted: false,
          },
          skip: parseInt(offset),
          take: parseInt(limit),
          orderBy: { created_at: "desc" },
          include: {
            author: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          comments,
          totalCount,
        },
      });
    }
  );

  // POST /comments - 댓글 생성
  const createCommentBodySchema = z.object({
    post_id: z.string().uuid(),
    content: z.string().min(1),
    parent_id: z.string().uuid().optional(),
  });

  fastify.post(
    "/",
    { preHandler: requiredAuthenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createCommentBodySchema.parse(request.body);
      const { post_id, content, parent_id } = body;
      const author_id = request.user!.id;

      const comment = await prisma.comment.create({
        data: {
          post_id,
          author_id: author_id!,
          content,
          parent_id,
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      return reply.status(201).send({
        success: true,
        data: comment,
      });
    }
  );

  // PATCH /comments/:id - 댓글 수정
  const updateCommentParamsSchema = z.object({
    id: z.string().uuid(),
  });

  const updateCommentBodySchema = z.object({
    content: z.string().min(1),
  });

  fastify.patch(
    "/:id",
    { preHandler: requiredAuthenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = updateCommentParamsSchema.parse(request.params);
      const { content } = updateCommentBodySchema.parse(request.body);

      const existingComment = await prisma.comment.findUnique({
        where: { id },
      });

      if (!existingComment || existingComment.is_deleted) {
        return reply.status(404).send({
          success: false,
          error: "댓글을 찾을 수 없습니다.",
        });
      }

      if (existingComment.author_id !== request.user!.id && request.user!.role !== "OWNER") {
        return reply.status(403).send({
          success: false,
          error: "댓글을 수정할 권한이 없습니다.",
        });
      }

      const comment = await prisma.comment.update({
        where: { id },
        data: { content },
        include: {
          author: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      return reply.send({
        success: true,
        data: comment,
      });
    }
  );

  // DELETE /comments/:id - 댓글 삭제 (soft delete)
  const deleteCommentParamsSchema = z.object({
    id: z.string().uuid(),
  });

  fastify.delete(
    "/:id",
    { preHandler: requiredAuthenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = deleteCommentParamsSchema.parse(request.params);

      const existingComment = await prisma.comment.findUnique({
        where: { id },
      });

      if (!existingComment || existingComment.is_deleted) {
        return reply.status(404).send({
          success: false,
          error: "댓글을 찾을 수 없습니다.",
        });
      }

      if (existingComment.author_id !== request.user!.id && request.user!.role !== "OWNER") {
        return reply.status(403).send({
          success: false,
          error: "댓글을 삭제할 권한이 없습니다.",
        });
      }

      await prisma.comment.update({
        where: { id },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
        },
      });

      return reply.send({
        success: true,
        message: "댓글이 삭제되었습니다.",
      });
    }
  );
};

export default commentsRoutes;
