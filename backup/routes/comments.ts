import express, { Request, Response } from "express";
import { CreateCommentSchema, UpdateCommentSchema } from "../lib/schemas.js";
import { prisma } from "../lib/prismaClient.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requiredAuthenticate, optionalAuthenticate } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../types/express.js";

const router = express.Router();

// GET /comments -> 댓글 목록 조회
router.get(
  "/",
  optionalAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { postId, offset = "0", limit = "10" } = req.query;

    if (!postId) {
      res.status(400).json({
        success: false,
        error: "postId가 필요합니다.",
      });
      return;
    }

    const postIdNum = parseInt(postId as string);

    const [totalCount, comments] = await Promise.all([
      prisma.comment.count({
        where: {
          postId: postIdNum,
        },
      }),
      prisma.comment.findMany({
        where: {
          postId: postIdNum,
          parentCommentId: null, // 최상위 댓글만
        },
        skip: parseInt(offset as string),
        take: parseInt(limit as string),
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          replies: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
              _count: {
                select: {
                  commentLikes: true,
                },
              },
              commentLikes: req.user?.id
                ? {
                    where: {
                      userId: req.user.id,
                    },
                    select: {
                      id: true,
                    },
                  }
                : false,
              replies: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                  _count: {
                    select: {
                      commentLikes: true,
                    },
                  },
                  commentLikes: req.user?.id
                    ? {
                        where: {
                          userId: req.user.id,
                        },
                        select: {
                          id: true,
                        },
                      }
                    : false,
                  replies: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                      _count: {
                        select: {
                          commentLikes: true,
                        },
                      },
                      commentLikes: req.user?.id
                        ? {
                            where: {
                              userId: req.user.id,
                            },
                            select: {
                              id: true,
                            },
                          }
                        : false,
                    },
                    orderBy: {
                      createdAt: "asc",
                    },
                  },
                },
                orderBy: {
                  createdAt: "asc",
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          _count: {
            select: {
              commentLikes: true,
            },
          },
          commentLikes: req.user?.id
            ? {
                where: {
                  userId: req.user.id,
                },
                select: {
                  id: true,
                },
              }
            : false,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

    // 댓글에 명확한 네이밍으로 변환 (재귀적으로 처리)
    const transformComment = (comment: any): any => {
      const { _count, commentLikes, replies, ...commentWithoutCount } = comment;
      return {
        ...commentWithoutCount,
        likesCount: _count.commentLikes,
        isLiked: commentLikes?.length > 0 || false,
        replies: replies ? replies.map(transformComment) : [],
      };
    };

    const commentsWithCounts = comments.map(transformComment);

    res.json({
      success: true,
      data: commentsWithCounts,
      meta: {
        totalCount,
        offset: parseInt(offset as string),
        limit: parseInt(limit as string),
      },
    });
  })
);

// POST /comments -> 댓글 생성
router.post(
  "/",
  requiredAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const validatedData = CreateCommentSchema.parse(req.body);

    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        error: "인증이 필요합니다.",
      });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        ...validatedData,
        userId: req.user.id,
        // 부모 댓글이 있는 경우 depth 계산
        depth: validatedData.parentCommentId
          ? await prisma.comment
              .findUnique({
                where: { id: validatedData.parentCommentId },
                select: { depth: true },
              })
              .then((parent) => (parent?.depth || 0) + 1)
          : 0,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            commentLikes: true,
          },
        },
      },
    });

    const { _count, ...commentWithoutCount } = comment;
    const commentWithCounts = {
      ...commentWithoutCount,
      likesCount: _count.commentLikes,
      isLiked: false, // 새로 생성된 댓글이므로 항상 false
    };

    res.status(201).json({
      success: true,
      data: commentWithCounts,
    });
  })
);

// PATCH /comments/:id -> 댓글 수정
router.patch(
  "/:id",
  requiredAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const validatedData = UpdateCommentSchema.parse(req.body);

    const existingComment = await prisma.comment.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingComment) {
      res.status(404).json({
        success: false,
        error: "댓글을 찾을 수 없습니다.",
      });
      return;
    }

    // 작성자 또는 관리자만 수정 가능
    if (existingComment.userId !== req.user?.id && !req.user?.isOwner) {
      res.status(403).json({
        success: false,
        error: "댓글 수정 권한이 없습니다.",
      });
      return;
    }

    const updatedComment = await prisma.comment.update({
      where: { id: parseInt(id) },
      data: {
        ...validatedData,
        isEdited: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            commentLikes: true,
          },
        },
        commentLikes: req.user?.id
          ? {
              where: {
                userId: req.user.id,
              },
              select: {
                id: true,
              },
            }
          : false,
      },
    });

    const { _count, commentLikes, ...commentWithoutCount } = updatedComment;
    const commentWithCounts = {
      ...commentWithoutCount,
      likesCount: _count.commentLikes,
      isLiked: commentLikes?.length > 0 || false,
    };

    res.json({
      success: true,
      data: commentWithCounts,
    });
  })
);

// DELETE /comments/:id -> 댓글 삭제
router.delete(
  "/:id",
  requiredAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    const existingComment = await prisma.comment.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingComment) {
      res.status(404).json({
        success: false,
        error: "댓글을 찾을 수 없습니다.",
      });
      return;
    }

    // 작성자 또는 관리자만 삭제 가능
    if (existingComment.userId !== req.user?.id && !req.user?.isOwner) {
      res.status(403).json({
        success: false,
        error: "댓글 삭제 권한이 없습니다.",
      });
      return;
    }

    await prisma.comment.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: "댓글이 삭제되었습니다.",
    });
  })
);

// POST /comments/:id/like -> 댓글 좋아요/취소
router.post(
  "/:id/like",
  requiredAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id;
    const commentId = parseInt(id);

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (!commentId || isNaN(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }

    // 트랜잭션을 사용하여 좋아요 처리와 댓글 업데이트를 원자적으로 수행
    const result = await prisma.$transaction(async (prisma) => {
      // 유저가 해당 댓글에 좋아요를 눌렀는지 확인
      const existingLike = await prisma.commentLike.findUnique({
        where: {
          commentId_userId: { userId, commentId },
        },
      });

      let isLiked;
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

        isLiked = false;
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

        isLiked = true;
      }

      return { updatedComment, isLiked };
    });

    res.json({
      success: true,
      data: {
        comment: result.updatedComment,
        isLiked: result.isLiked,
      },
    });
  })
);

export default router;
