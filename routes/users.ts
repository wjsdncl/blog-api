import express, { Request, Response } from "express";
import { prisma } from "../lib/prismaClient.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requiredAuthenticate, optionalAuthenticate } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../types/express.js";

const router = express.Router();

// GET /users/:id -> 사용자 정보 조회
router.get(
  "/:id",
  optionalAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: req.user?.id === id || req.user?.isOwner, // 본인이거나 관리자만 이메일 볼 수 있음
        isOwner: true,
        createdAt: true,
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: "사용자를 찾을 수 없습니다.",
      });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  })
);

// PATCH /users/:id -> 사용자 정보 수정
router.patch(
  "/:id",
  requiredAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name } = req.body;

    // 본인이거나 관리자만 수정 가능
    if (req.user?.id !== id && !req.user?.isOwner) {
      res.status(403).json({
        success: false,
        error: "수정 권한이 없습니다.",
      });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { name },
      select: {
        id: true,
        name: true,
        email: true,
        isOwner: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      data: updatedUser,
    });
  })
);

export default router;
