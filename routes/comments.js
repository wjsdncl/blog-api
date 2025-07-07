import express from "express";
import { assert } from "superstruct";
import { CreateComment, UpdateComment, LikeComment } from "../lib/structs.js";
import { prisma } from "../lib/prismaClient.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requiredAuthenticate, optionalAuthenticate } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

// GET /comments -> 모든 댓글 정보를 가져옴
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { offset = 0, limit = 10 } = req.query;

    const comments = await prisma.comment.findMany({
      skip: parseInt(offset),
      take: parseInt(limit),
      orderBy: { createdAt: "desc" },
      include: {
        post: { select: { title: true } },
        user: { select: { email: true, name: true } },
        replies: { include: { user: { select: { email: true, name: true } } } },
      },
    });

    logger.info("Comments fetched", { count: comments.length });

    res.json({
      success: true,
      data: comments,
      meta: {
        pagination: {
          offset: parseInt(offset),
          limit: parseInt(limit),
        },
      },
    });
  })
);

// GET /comments/:postId -> 특정 포스트의 댓글 정보를 가져옴
router.get(
  "/:postId",
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { offset = 0, limit = 10 } = req.query;
    const { postId } = req.params;
    const userId = req.user?.userId;

    const post = await prisma.post.findUniqueOrThrow({
      where: { id: parseInt(postId) },
      select: { id: true },
    });

    const [totalComments, parentComments, comments] = await Promise.all([
      prisma.comment.count({
        where: { postId: post.id },
      }),

      prisma.comment.count({
        where: { postId: post.id, parentCommentId: null },
      }),

      prisma.comment.findMany({
        where: { postId: post.id, parentCommentId: null },
        orderBy: { createdAt: "desc" },
        skip: parseInt(offset),
        take: parseInt(limit),
        include: {
          user: { select: { email: true, name: true } },
          replies: {
            include: {
              user: { select: { email: true, name: true } },
              replies: {
                include: {
                  user: { select: { email: true, name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    // 좋아요 상태 확인 함수
    const checkLikes = async (comment) => {
      let isLiked = false;

      if (userId) {
        const existingLike = await prisma.commentLike.findUnique({
          where: {
            commentId_userId: { userId, commentId: comment.id },
          },
        });
        isLiked = !!existingLike;
      }

      const repliesWithLikes = comment.replies ? await Promise.all(comment.replies.map(checkLikes)) : [];

      return {
        ...comment,
        isLiked,
        replies: repliesWithLikes,
      };
    };

    const commentsWithLikes = await Promise.all(comments.map(checkLikes));

    logger.info("Post comments fetched", {
      postId: post.id,
      count: comments.length,
      userId: userId || "anonymous",
    });

    res.json({
      success: true,
      data: {
        totalComments,
        parentComments,
        comments: commentsWithLikes,
      },
      meta: {
        pagination: {
          offset: parseInt(offset),
          limit: parseInt(limit),
        },
      },
    });
  })
);

// POST /comments -> 댓글 또는 대댓글 작성
router.post(
  "/",
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    assert(req.body, CreateComment);

    const { content, userId, postId, parentCommentId } = req.body;

    const newComment = await prisma.comment.create({
      data: {
        content,
        user: userId ? { connect: { id: userId } } : undefined,
        post: { connect: { id: postId } },
        parentComment: parentCommentId ? { connect: { id: parentCommentId } } : undefined,
      },
      include: {
        user: { select: { email: true, name: true } },
        post: { select: { title: true } },
        parentComment: { select: { id: true, content: true } },
      },
    });

    logger.info("Comment created", {
      commentId: newComment.id,
      postId,
      userId,
      isReply: !!parentCommentId,
    });

    res.status(201).json({
      success: true,
      data: newComment,
    });
  })
);

// POST /comments/:id/like -> 특정 댓글에 좋아요를 누름
router.post(
  "/:id/like",
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const commentId = parseInt(id);

    assert({ userId, commentId }, LikeComment);

    // 트랜잭션을 사용하여 좋아요 처리와 댓글 업데이트를 원자적으로 수행
    const result = await prisma.$transaction(async (prisma) => {
      const existingLike = await prisma.commentLike.findUnique({
        where: {
          commentId_userId: { userId, commentId },
        },
      });

      let isLike;
      let updatedComment;

      if (existingLike) {
        // 좋아요 취소
        await prisma.commentLike.delete({
          where: {
            commentId_userId: { userId, commentId },
          },
        });

        updatedComment = await prisma.comment.update({
          where: { id: commentId },
          data: { likesCount: { decrement: 1 } },
          select: { id: true, content: true, likesCount: true },
        });

        isLike = false;
      } else {
        // 좋아요 추가
        await prisma.commentLike.create({
          data: {
            userId,
            commentId,
          },
        });

        updatedComment = await prisma.comment.update({
          where: { id: commentId },
          data: { likesCount: { increment: 1 } },
          select: { id: true, content: true, likesCount: true },
        });

        isLike = true;
      }

      return { updatedComment, isLike };
    });

    logger.info("Comment like toggled", {
      commentId,
      userId,
      isLike: result.isLike,
    });

    res.json({
      success: true,
      data: {
        comment: result.updatedComment,
        isLike: result.isLike,
      },
    });
  })
);

// PATCH /comments/:id -> 특정 댓글을 수정
router.patch(
  "/:id",
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    assert(req.body, UpdateComment);

    const id = Number(req.params.id);

    // 댓글 소유권 확인
    const existingComment = await prisma.comment.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingComment) {
      return res.status(404).json({
        success: false,
        error: "댓글을 찾을 수 없습니다.",
      });
    }

    if (existingComment.userId !== req.user.userId && !req.user.isOwner) {
      logger.warn("Unauthorized comment update attempt", {
        commentId: id,
        requesterId: req.user.userId,
        ownerId: existingComment.userId,
      });
      return res.status(403).json({
        success: false,
        error: "본인의 댓글만 수정할 수 있습니다.",
      });
    }

    const comment = await prisma.comment.update({
      where: { id },
      data: req.body,
    });

    logger.info("Comment updated", { commentId: id, userId: req.user.userId });

    res.json({
      success: true,
      data: comment,
    });
  })
);

// DELETE /comments/:id -> 댓글 삭제
router.delete(
  "/:id",
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 삭제할 댓글이 존재하는지 확인
    const comment = await prisma.comment.findUnique({
      where: { id: parseInt(id) },
      include: {
        replies: true,
      },
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: "댓글을 찾을 수 없습니다.",
      });
    }

    // 댓글 소유권 확인
    if (comment.userId !== req.user.userId && !req.user.isOwner) {
      logger.warn("Unauthorized comment deletion attempt", {
        commentId: parseInt(id),
        requesterId: req.user.userId,
        ownerId: comment.userId,
      });
      return res.status(403).json({
        success: false,
        error: "본인의 댓글만 삭제할 수 있습니다.",
      });
    }

    // 대댓글이 있는 경우 내용만 삭제하고 구조는 유지
    if (comment.replies && comment.replies.length > 0) {
      await prisma.comment.update({
        where: { id: parseInt(id) },
        data: {
          content: "[삭제된 댓글입니다]",
          userId: null,
        },
      });

      logger.info("Comment content deleted (has replies)", {
        commentId: parseInt(id),
        userId: req.user.userId,
      });

      res.json({
        success: true,
        message: "댓글이 삭제되었습니다.",
      });
    } else {
      // 대댓글이 없는 경우 완전 삭제
      await prisma.comment.delete({
        where: { id: parseInt(id) },
      });

      logger.info("Comment completely deleted", {
        commentId: parseInt(id),
        userId: req.user.userId,
      });

      res.status(204).send();
    }
  })
);

export default router;
