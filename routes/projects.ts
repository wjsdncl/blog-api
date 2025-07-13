import express, { Request, Response } from "express";
import { CreateProjectSchema, UpdateProjectSchema } from "../lib/schemas.js";
import { prisma } from "../lib/prismaClient.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requiredAuthenticate, optionalAuthenticate } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../types/express.js";

const router = express.Router();

const createSlug = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣ㄱ-ㅎ\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

// GET /projects -> 프로젝트 목록 조회
router.get(
  "/",
  optionalAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { offset = "0", limit = "10", category: categorySlug = "", tag: tagSlug = "" } = req.query;

    const isOwner = req.user?.isOwner;

    const where: any = {
      ...(categorySlug && { category: { slug: categorySlug } }),
      ...(tagSlug && { tags: { some: { slug: tagSlug as string } } }),
      ...(!isOwner && { isActive: true }),
    };

    const [totalCount, projects] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        skip: parseInt(offset as string),
        take: parseInt(limit as string),
        include: {
          category: { select: { name: true, slug: true } },
          tags: { select: { name: true, slug: true } },
        },
        orderBy: {
          priority: "desc",
        },
      }),
    ]);

    res.json({
      success: true,
      data: projects,
      meta: {
        pagination: {
          offset: parseInt(offset as string),
          limit: parseInt(limit as string),
          total: totalCount,
        },
      },
    });
  })
);

// GET /projects/:id -> 특정 프로젝트 조회
router.get(
  "/:id",
  optionalAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const isOwner = req.user?.isOwner;

    const project = await prisma.project.findUnique({
      where: {
        id: parseInt(id),
        ...(!isOwner && { isActive: true }),
      },
      include: {
        category: { select: { name: true, slug: true } },
        tags: { select: { name: true, slug: true } },
      },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        error: "프로젝트를 찾을 수 없습니다.",
      });
      return;
    }

    res.json({
      success: true,
      data: project,
    });
  })
);

// POST /projects -> 프로젝트 생성
router.post(
  "/",
  requiredAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user?.isOwner) {
      res.status(403).json({
        success: false,
        error: "프로젝트 생성 권한이 없습니다.",
      });
      return;
    }

    const validatedData = CreateProjectSchema.parse(req.body);
    const slug = createSlug(validatedData.title);

    // 관계 필드들을 별도로 처리
    const { categoryId, ...projectData } = validatedData;

    const project = await prisma.project.create({
      data: {
        title: projectData.title,
        description: projectData.description,
        content: projectData.content,
        images: projectData.images,
        summary: projectData.summary,
        slug,
        startDate: new Date(validatedData.startDate),
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        categoryId: categoryId || null,
        isPersonal: projectData.isPersonal,
        isActive: projectData.isActive,
        priority: projectData.priority,
      },
      include: {
        category: { select: { name: true, slug: true } },
        tags: { select: { name: true, slug: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: project,
    });
  })
);

export default router;
