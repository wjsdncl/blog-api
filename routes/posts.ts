import express, { Request, Response } from "express";
import { getChoseong } from "es-hangul";
import { CreatePostSchema, UpdatePostSchema } from "../lib/schemas.js";
import { prisma } from "../lib/prismaClient.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requiredAuthenticate, optionalAuthenticate } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../types/express.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

// GET /posts -> Get all posts
router.get(
  "/",
  optionalAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { offset = "0", limit = "10", order = "newest", category: categorySlug = "", tag: tagSlug = "", search = "" } = req.query;

    let orderBy: any;
    switch (order) {
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "newest":
        orderBy = { createdAt: "desc" };
        break;
      case "like":
        orderBy = { likesCount: "desc" };
        break;
      default:
        orderBy = { createdAt: "desc" };
    }

    const isOwner = req.user?.isOwner;

    const where: any = {
      ...(categorySlug && { category: { slug: categorySlug } }),
      ...(tagSlug && { tags: { some: { slug: tagSlug as string } } }),
      ...(search && {
        choseongTitle: {
          contains: getChoseong(search as string).replace(/\s+/g, ""),
          mode: "insensitive",
        },
      }),
      ...(!isOwner && { isPrivate: false }),
    };

    const [totalCount, posts, categories] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findMany({
        where,
        orderBy,
        skip: parseInt(offset as string),
        take: parseInt(limit as string),
        include: {
          category: { select: { name: true, slug: true } },
          tags: { select: { name: true, slug: true } },
          _count: { select: { comments: true, postLikes: true } },
        },
      }),
      prisma.category.findMany({
        include: {
          _count: {
            select: { posts: true },
          },
        },
      }),
    ]);

    // posts에 명확한 네이밍으로 변환
    const postsWithCounts = posts.map((post) => ({
      ...post,
      commentsCount: post._count.comments,
      likesCount: post._count.postLikes,
      _count: undefined,
    }));

    // categories에 명확한 네이밍으로 변환
    const categoriesWithCounts = categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      createdAt: category.createdAt,
      postsCount: category._count.posts,
    }));

    res.json({
      success: true,
      data: postsWithCounts,
      categories: categoriesWithCounts,
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

export default router;
