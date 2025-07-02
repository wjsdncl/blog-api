import express from "express";
import { prisma } from "../lib/prismaClient.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

// GET /projects -> 모든 프로젝트 정보 가져오기
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { offset = 0, limit = 10, isPersonal } = req.query;

    const where = {};
    if (isPersonal !== undefined) {
      where.isPersonal = isPersonal === "true";
    }

    const [projects, totalCount] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: parseInt(offset),
        take: parseInt(limit),
      }),
      prisma.project.count({ where }),
    ]);

    logger.info("Projects fetched", { count: projects.length, totalCount });

    res.json({
      success: true,
      data: projects,
      meta: {
        pagination: {
          offset: parseInt(offset),
          limit: parseInt(limit),
          total: totalCount,
        },
      },
    });
  })
);

// GET /projects/:id -> 특정 프로젝트 정보 가져오기
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: Number(id) },
    });

    logger.info("Project viewed", { projectId: project.id });

    res.json({
      success: true,
      data: project,
    });
  })
);

// POST /projects -> 새로운 프로젝트 생성
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { title, isPersonal, startDate, endDate, description, images, content, summary, techStack, githubLink, projectLink } = req.body;

    const newProject = await prisma.project.create({
      data: {
        title,
        isPersonal,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        description,
        images,
        content,
        summary,
        techStack,
        githubLink,
        projectLink,
      },
    });

    logger.info("Project created", { projectId: newProject.id, title });

    res.status(201).json({
      success: true,
      data: newProject,
    });
  })
);

// PATCH /projects/:id -> 특정 프로젝트 정보 수정
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const updatedProject = await prisma.project.update({
      where: { id: Number(id) },
      data: {
        ...req.body,
        ...(req.body.startDate && { startDate: new Date(req.body.startDate) }),
        ...(req.body.endDate && { endDate: new Date(req.body.endDate) }),
      },
    });

    logger.info("Project updated", { projectId: Number(id) });

    res.json({
      success: true,
      data: updatedProject,
    });
  })
);

// DELETE /projects/:id -> 특정 프로젝트 삭제
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await prisma.project.delete({
      where: { id: Number(id) },
    });

    logger.info("Project deleted", { projectId: Number(id) });

    res.status(204).send();
  })
);

export default router;
