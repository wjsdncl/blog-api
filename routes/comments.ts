import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prismaClient.js";
import { requiredAuthenticate, optionalAuthenticate } from "../middleware/auth.js";
import type { PrismaClient } from "@prisma/client";

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
            parent_id: null, // 최상위 댓글만
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
            replies: {
              where: { is_deleted: false },
              orderBy: { created_at: "asc" },
              include: {
                author: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
                comment_likes: request.user?.id
                  ? {
                      where: { user_id: request.user.id },
                      select: { id: true },
                    }
                  : false,
              },
            },
            comment_likes: request.user?.id
              ? {
                  where: { user_id: request.user.id },
                  select: { id: true },
                }
              : false,
          },
        }),
      ]);

      const commentsWithLikes = comments.map((comment: any) => ({
        ...comment,
        isLiked: Array.isArray(comment.comment_likes) && comment.comment_likes.length > 0,
        replies: comment.replies.map((reply: any) => ({
          ...reply,
          isLiked: Array.isArray(reply.comment_likes) && reply.comment_likes.length > 0,
          comment_likes: undefined,
        })),
        comment_likes: undefined,
      }));

      return reply.send({
        success: true,
        data: {
          comments: commentsWithLikes,
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

      // parent_id가 있으면 답글
      if (parent_id) {
        const parentComment = await prisma.comment.findUnique({
          where: { id: parent_id },
        });

        if (!parentComment || parentComment.is_deleted) {
          return reply.status(404).send({
            success: false,
            error: "부모 댓글을 찾을 수 없습니다.",
          });
        }
      }

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

      // 게시글의 comment_count 증가
      await prisma.post.update({
        where: { id: post_id },
        data: { comment_count: { increment: 1 } },
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

      // 게시글의 comment_count 감소
      await prisma.post.update({
        where: { id: existingComment.post_id },
        data: { comment_count: { decrement: 1 } },
      });

      return reply.send({
        success: true,
        message: "댓글이 삭제되었습니다.",
      });
    }
  );

  // POST /comments/:id/like - 댓글 좋아요 토글
  const likeCommentParamsSchema = z.object({
    id: z.string().uuid(),
  });

  fastify.post(
    "/:id/like",
    { preHandler: requiredAuthenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: commentId } = likeCommentParamsSchema.parse(request.params);
      const userId = request.user!.id!;

      const result = await prisma.$transaction(async (tx) => {
        const existingLike = await tx.commentLike.findUnique({
          where: {
            user_id_comment_id: { user_id: userId, comment_id: commentId },
          },
        });

        let liked: boolean;
        let updatedComment;

        if (existingLike) {
          // 좋아요 취소
          await tx.commentLike.delete({
            where: {
              user_id_comment_id: { user_id: userId, comment_id: commentId },
            },
          });

          updatedComment = await tx.comment.update({
            where: { id: commentId },
            data: { like_count: { decrement: 1 } },
            select: { like_count: true },
          });

          liked = false;
        } else {
          // 좋아요 추가
          await tx.commentLike.create({
            data: {
              user_id: userId,
              comment_id: commentId,
            },
          });

          updatedComment = await tx.comment.update({
            where: { id: commentId },
            data: { like_count: { increment: 1 } },
            select: { like_count: true },
          });

          liked = true;
        }

        return { liked, likeCount: updatedComment.like_count };
      });

      return reply.send({
        success: true,
        data: result,
      });
    }
  );
};

export default commentsRoutes;
