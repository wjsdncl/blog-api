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

    const comments = await prisma.comment.findMany({
      where: {
        postId: parseInt(postId as string),
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
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      success: true,
      data: comments,
    });
  })
);

// POST /comments -> 댓글 생성
router.post(
  "/",
  requiredAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const validatedData = CreateCommentSchema.parse(req.body);

    const comment = await prisma.comment.create({
      data: {
        ...validatedData,
        userId: req.user!.userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: comment,
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
    if (existingComment.userId !== req.user?.userId && !req.user?.isOwner) {
      res.status(403).json({
        success: false,
        error: "댓글 수정 권한이 없습니다.",
      });
      return;
    }

    const updatedComment = await prisma.comment.update({
      where: { id: parseInt(id) },
      data: validatedData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: updatedComment,
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
    if (existingComment.userId !== req.user?.userId && !req.user?.isOwner) {
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

export default router;
