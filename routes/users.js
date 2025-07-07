import express from "express";
import { assert } from "superstruct";
import { UpdateUser } from "../lib/structs.js";
import { prisma } from "../lib/prismaClient.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requiredAuthenticate } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

// GET /users/me -> accessToken을 사용하여 현재 유저 정보를 가져옴
router.get(
  "/me",
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      logger.warn("User not found for authenticated request", { userId: req.user.userId });
      return res.status(404).json({
        success: false,
        error: "유저 정보를 찾을 수 없습니다.",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  })
);

// PATCH /users/:id -> 특정 유저 정보를 수정
router.patch(
  "/:id",
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    assert({ email: req.body.email, name: req.body.name }, UpdateUser);

    const { id } = req.params;

    // 권한 확인: 본인 또는 관리자만 수정 가능
    if (req.user.userId !== id && !req.user.isOwner) {
      logger.warn("Unauthorized user update attempt", {
        requesterId: req.user.userId,
        targetId: id,
      });
      return res.status(403).json({
        success: false,
        error: "본인의 정보만 수정할 수 있습니다.",
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: req.body,
    });

    logger.info("User updated", { userId: id, updatedBy: req.user.userId });

    res.json({
      success: true,
      data: user,
    });
  })
);

// DELETE /users/:id -> 특정 유저 정보를 삭제
router.delete(
  "/:id",
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 권한 확인: 본인 또는 관리자만 삭제 가능
    if (req.user.userId !== id && !req.user.isOwner) {
      logger.warn("Unauthorized user deletion attempt", {
        requesterId: req.user.userId,
        targetId: id,
      });
      return res.status(403).json({
        success: false,
        error: "본인의 계정만 삭제할 수 있습니다.",
      });
    }

    await prisma.user.delete({
      where: { id },
    });

    logger.info("User deleted", { userId: id, deletedBy: req.user.userId });

    res.status(204).send();
  })
);

export default router;
