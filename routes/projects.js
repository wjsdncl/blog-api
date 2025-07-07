import express from 'express';
import { prisma } from '../lib/prismaClient.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requiredAuthenticate, optionalAuthenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const createSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣ㄱ-ㅎ\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

// GET /projects -> 모든 프로젝트 정보를 가져옴
router.get(
  '/',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { category: categorySlug, tag: tagSlug } = req.query;
    const isOwner = req.user?.isOwner;

    const where = {
      ...(categorySlug && { category: { slug: categorySlug } }),
      ...(tagSlug && { tags: { some: { slug: tagSlug } } }),
      ...(!isOwner && { isActive: true }),
    };

    const projects = await prisma.project.findMany({
      where,
      orderBy: { priority: 'desc' },
      include: { category: true, tags: true, techStack: true },
    });
    res.json({ success: true, data: projects });
  })
);

// GET /projects/:slug -> 특정 프로젝트 정보를 가져옴
router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const project = await prisma.project.findUniqueOrThrow({
      where: { slug },
      include: { category: true, tags: true, techStack: true, links: true },
    });
    res.json({ success: true, data: project });
  })
);

// POST /projects -> 새 프로젝트 생성
router.post(
  '/',
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    if (!req.user.isOwner) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const { title, categoryId, tags, techStack, links, ...rest } = req.body;

    const slug = createSlug(title);

    const newProject = await prisma.project.create({
      data: {
        ...rest,
        title,
        slug,
        ...(categoryId && { category: { connect: { id: categoryId } } }),
        ...(tags && {
          tags: {
            connectOrCreate: tags.map((tag) => ({
              where: { name: tag },
              create: { name: tag, slug: createSlug(tag) },
            })),
          },
        }),
        ...(techStack && {
          techStack: {
            connectOrCreate: techStack.map((tech) => ({
              where: { name: tech },
              create: { name: tech },
            })),
          },
        }),
        ...(links && { links: { create: links } }),
      },
    });
    logger.info('Project created', { projectId: newProject.id });
    res.status(201).json({ success: true, data: newProject });
  })
);

// PATCH /projects/:id -> 프로젝트 수정
router.patch(
  '/:id',
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!req.user.isOwner) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const { title, categoryId, tags, techStack, links, ...rest } = req.body;

    let slug;
    if (title) {
      slug = createSlug(title);
    }

    const updatedProject = await prisma.project.update({
      where: { id: parseInt(id) },
      data: {
        ...rest,
        ...(title && { title }),
        ...(slug && { slug }),
        ...(categoryId && { category: { connect: { id: categoryId } } }),
        ...(tags && {
          tags: {
            set: [],
            connectOrCreate: tags.map((tag) => ({
              where: { name: tag },
              create: { name: tag, slug: createSlug(tag) },
            })),
          },
        }),
        ...(techStack && {
          techStack: {
            set: [],
            connectOrCreate: techStack.map((tech) => ({
              where: { name: tech },
              create: { name: tech },
            })),
          },
        }),
        ...(links && { links: { deleteMany: {}, create: links } }),
      },
    });
    logger.info('Project updated', { projectId: updatedProject.id });
    res.json({ success: true, data: updatedProject });
  })
);

// DELETE /projects/:id -> 프로젝트 삭제
router.delete(
  '/:id',
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!req.user.isOwner) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    await prisma.project.delete({ where: { id: parseInt(id) } });
    logger.info('Project deleted', { projectId: id });
    res.status(204).send();
  })
);

export default router;
