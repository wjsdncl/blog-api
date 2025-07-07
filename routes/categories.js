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

// GET /categories -> 모든 카테고리 정보를 가져옴
router.get('/', asyncHandler(async (req, res) => {
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: { posts: true, projects: true },
      },
    },
  });
  res.json({ success: true, data: categories });
}));

// POST /categories -> 새 카테고리 생성
router.post('/', requiredAuthenticate, asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!req.user.isOwner) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  const slug = createSlug(name);
  const newCategory = await prisma.category.create({
    data: { name, slug },
  });
  res.status(201).json({ success: true, data: newCategory });
}));

// PATCH /categories/:id -> 카테고리 수정
router.patch('/:id', requiredAuthenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!req.user.isOwner) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  const slug = createSlug(name);
  const updatedCategory = await prisma.category.update({
    where: { id: parseInt(id) },
    data: { name, slug },
  });
  res.json({ success: true, data: updatedCategory });
}));

// DELETE /categories/:id -> 카테고리 삭제
router.delete('/:id', requiredAuthenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!req.user.isOwner) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  await prisma.category.delete({ where: { id: parseInt(id) } });
  res.status(204).send();
}));

export default router;
