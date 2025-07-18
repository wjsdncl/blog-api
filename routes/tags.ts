import express, { Request, Response } from "express";
import { prisma } from "../lib/prismaClient.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requiredAuthenticate } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../types/express.js";

const router = express.Router();

const createSlug = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣ㄱ-ㅎ\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

// GET /tags -> 모든 태그 정보를 가져옴
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tags = await prisma.tag.findMany({
      include: {
        _count: {
          select: { posts: true, projects: true },
        },
      },
    });

    // 명확한 네이밍으로 변환
    const tagsWithCounts = tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      createdAt: tag.createdAt,
      postsCount: tag._count.posts,
      projectsCount: tag._count.projects,
      totalCount: tag._count.posts + tag._count.projects,
    }));

    res.json({ success: true, data: tagsWithCounts });
  })
);

// POST /tags -> 새 태그 생성
router.post(
  "/",
  requiredAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { name } = req.body;
    if (!req.user?.isOwner) {
      res.status(403).json({ success: false, message: "Unauthorized" });
      return;
    }
    const slug = createSlug(name);
    const newTag = await prisma.tag.create({
      data: { name, slug },
    });
    res.status(201).json({ success: true, data: newTag });
  })
);

// PATCH /tags/:id -> 태그 수정
router.patch(
  "/:id",
  requiredAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name } = req.body;
    if (!req.user?.isOwner) {
      res.status(403).json({ success: false, message: "Unauthorized" });
      return;
    }
    const slug = createSlug(name);
    const updatedTag = await prisma.tag.update({
      where: { id: parseInt(id) },
      data: { name, slug },
    });
    res.json({ success: true, data: updatedTag });
  })
);

// DELETE /tags/:id -> 태그 삭제
router.delete(
  "/:id",
  requiredAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!req.user?.isOwner) {
      res.status(403).json({ success: false, message: "Unauthorized" });
      return;
    }
    await prisma.tag.delete({
      where: { id: parseInt(id) },
    });
    res.json({ success: true, message: "Tag deleted successfully" });
  })
);

export default router;
