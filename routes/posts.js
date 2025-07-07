import express from 'express';
import { getChoseong } from 'es-hangul';
import { CreatePost, UpdatePost } from '../lib/structs.js';
import { prisma } from '../lib/prismaClient.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requiredAuthenticate, optionalAuthenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const createSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣ㄱ-ㅎ\s]/g, '') // remove special characters
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/-+/g, '-'); // replace multiple hyphens with a single one

// GET /posts -> Get all posts
router.get(
  '/',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { offset = 0, limit = 10, order = 'newest', category: categorySlug = '', tag: tagSlug = '', search = '' } = req.query;

    let orderBy;
    switch (order) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'like':
        orderBy = { likesCount: 'desc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const isOwner = req.user?.isOwner;

    const where = {
      ...(categorySlug && { category: { slug: categorySlug } }),
      ...(tagSlug && { tags: { some: { slug: tagSlug } } }),
      ...(search && {
        choseongTitle: {
          contains: getChoseong(search).replace(/\s+/g, ''),
          mode: 'insensitive',
        },
      }),
      ...(!isOwner && { isPrivate: false }),
    };

    const [totalCount, posts] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findMany({
        where,
        orderBy,
        skip: parseInt(offset),
        take: parseInt(limit),
        include: {
          category: { select: { name: true, slug: true } },
          tags: { select: { name: true, slug: true } },
          _count: { select: { comments: true, postLikes: true } },
        },
      }),
    ]);

    res.json({
      success: true,
      data: posts,
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

// GET /posts/:slug -> Get a specific post
router.get(
  '/:slug',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const userId = req.user?.id;

    const post = await prisma.post.findUniqueOrThrow({
      where: { slug },
      include: {
        category: true,
        tags: true,
        comments: {
          where: { parentCommentId: null },
          orderBy: { createdAt: 'asc' },
          include: {
            user: true,
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (post.isPrivate && !req.user?.isOwner) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    post.isLiked = false;
    if (userId) {
      const existingLike = await prisma.postLike.findUnique({
        where: {
          postId_userId: { userId, postId: post.id },
        },
      });
      post.isLiked = !!existingLike;
    }

    res.json({
      success: true,
      data: post,
    });
  })
);

// POST /posts -> Create a new post
router.post(
  '/',
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    if (!req.user.isOwner) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const [err, body] = CreatePost.validate(req.body);
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const { title, content, thumbnail, categoryId, tags, isPrivate } = body;

    let slugBase = createSlug(title);
    let slug = slugBase;
    let counter = 1;
    while (await prisma.post.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${counter++}`;
    }

    const choseongTitle = getChoseong(title).replace(/\s+/g, '');

    const newPost = await prisma.post.create({
      data: {
        title,
        choseongTitle,
        content,
        slug,
        thumbnail,
        isPrivate,
        
        ...(categoryId && { category: { connect: { id: categoryId } } }),
        ...(tags &&
          tags.length > 0 && {
            tags: {
              connectOrCreate: tags.map((tagName) => ({
                where: { name: tagName },
                create: { name: tagName, slug: createSlug(tagName) },
              })),
            },
          }),
      },
      include: {
        category: true,
        tags: true,
      },
    });

    res.status(201).json({
      success: true,
      data: newPost,
    });
  })
);

// POST /posts/:id/like -> Like a post
router.post(
  '/:id/like',
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    const postId = parseInt(req.params.id);
    const userId = req.user.userId;

    const result = await prisma.$transaction(async (tx) => {
      const existingLike = await tx.postLike.findUnique({
        where: { postId_userId: { userId, postId } },
      });

      let isLiked;
      if (existingLike) {
        await tx.postLike.delete({ where: { postId_userId: { userId, postId } } });
        isLiked = false;
      } else {
        await tx.postLike.create({ data: { userId, postId } });
        isLiked = true;
      }

      const updatedPost = await tx.post.update({
        where: { id: postId },
        data: { likesCount: { [isLiked ? 'increment' : 'decrement']: 1 } },
        select: { id: true, title: true, likesCount: true },
      });

      return { updatedPost, isLiked };
    });

    res.json({
      success: true,
      data: {
        post: result.updatedPost,
        isLiked: result.isLiked,
      },
    });
  })
);

// PATCH /posts/:id -> Update a post
router.patch(
  '/:id',
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    if (!req.user.isOwner) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const postId = parseInt(req.params.id);
    const [err, body] = UpdatePost.validate(req.body);
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const { title, content, thumbnail, categoryId, tags, isPrivate } = body;

    const postToUpdate = await prisma.post.findUniqueOrThrow({ where: { id: postId } });

    let slug = postToUpdate.slug;
    let choseongTitle;
    if (title && title !== postToUpdate.title) {
      let slugBase = createSlug(title);
      slug = slugBase;
      let counter = 1;
      while (await prisma.post.findFirst({ where: { slug, NOT: { id: postId } } })) {
        slug = `${slugBase}-${counter++}`;
      }
      choseongTitle = getChoseong(title).replace(/\s+/g, '');
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        title,
        content,
        thumbnail,
        isPrivate,
        
        slug,
        ...(choseongTitle && { choseongTitle }),
        ...(categoryId && { category: { connect: { id: categoryId } } }),
        ...(tags && {
          tags: {
            set: [], // Disconnect all existing tags first
            connectOrCreate: tags.map((tagName) => ({
              where: { name: tagName },
              create: { name: tagName, slug: createSlug(tagName) },
            })),
          },
        }),
      },
      include: {
        category: true,
        tags: true,
      },
    });

    res.json({
      success: true,
      data: updatedPost,
    });
  })
);

// DELETE /posts/:id -> Delete a post
router.delete(
  '/:id',
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    if (!req.user.isOwner) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const postId = parseInt(req.params.id);

    await prisma.post.findUniqueOrThrow({ where: { id: postId } });

    await prisma.post.delete({ where: { id: postId } });

    res.status(204).send();
  })
);

export default router;
