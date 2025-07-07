import express from 'express';
import { prisma } from '../lib/prismaClient.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requiredAuthenticate } from '../middleware/auth.js';

const router = express.Router();

const createSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣ㄱ-ㅎ\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

// GET /tags -> 모든 태그 정보를 가져옴
router.get('/', asyncHandler(async (req, res) => {
  const tags = await prisma.tag.findMany({
    include: {
      _count: {
        select: { posts: true, projects: true },
      },
    },
  });
  res.json({ success: true, data: tags });
}));

// POST /tags -> 새 태그 생성
router.post('/', requiredAuthenticate, asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!req.user.isOwner) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  const slug = createSlug(name);
  const newTag = await prisma.tag.create({
    data: { name, slug },
  });
  res.status(201).json({ success: true, data: newTag });
}));

// PATCH /tags/:id -> 태그 수정
router.patch('/:id', requiredAuthenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!req.user.isOwner) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  const slug = createSlug(name);
  const updatedTag = await prisma.tag.update({
    where: { id: parseInt(id) },
    data: { name, slug },
  });
  res.json({ success: true, data: updatedTag });
}));

// DELETE /tags/:id -> 태그 삭제
router.delete('/:id', requiredAuthenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!req.user.isOwner) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  await prisma.tag.delete({ where: { id: parseInt(id) } });
  res.status(204).send();
}));

export default router;
