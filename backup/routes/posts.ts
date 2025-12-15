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
          postLikes: req.user?.id
            ? {
                where: {
                  userId: req.user.id,
                },
                select: {
                  id: true,
                },
              }
            : false,
        },
      }),
      prisma.category.findMany({
        include: {
          _count: {
            select: {
              posts: {
                where: {
                  ...(!isOwner && { isPrivate: false }),
                },
              },
            },
          },
        },
      }),
    ]);

    // posts에 명확한 네이밍으로 변환
    const postsWithCounts = posts.map((post) => ({
      ...post,
      commentsCount: post._count.comments,
      likesCount: post._count.postLikes,
      isLiked: post.postLikes?.length > 0 || false,
      _count: undefined,
      postLikes: undefined,
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

// GET /posts/:slug -> Get a single post
router.get(
  "/:slug",
  optionalAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { slug } = req.params;
    const userId = req.user?.id;
    const isOwner = req.user?.isOwner;

    const post = await prisma.post.findUnique({
      where: { slug },
      include: {
        category: { select: { name: true, slug: true } },
        tags: { select: { name: true, slug: true } },
        _count: { select: { comments: true, postLikes: true } },
      },
    });

    if (!post) {
      res.status(404).json({ success: false, message: "Post not found" });
      return;
    }

    // Private 포스트는 owner만 볼 수 있음
    if (post.isPrivate && !isOwner) {
      res.status(404).json({ success: false, message: "Post not found" });
      return;
    }

    let isLiked = false;
    // 로그인된 유저일 경우에만 좋아요 여부를 검사
    if (userId) {
      const existingLike = await prisma.postLike.findUnique({
        where: {
          postId_userId: { userId, postId: post.id },
        },
      });
      isLiked = !!existingLike;
    }

    const postWithCounts = {
      ...post,
      commentsCount: post._count.comments,
      likesCount: post._count.postLikes,
      isLiked,
      _count: undefined,
    };

    res.json({ success: true, data: postWithCounts });
  })
);

// POST /posts -> 포스트 정보를 생성
router.post(
  "/",
  requiredAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { title, content, thumbnail, categoryId, tags = [], isPrivate = false } = req.body;

    if (!req.user?.isOwner) {
      res.status(403).json({ success: false, message: "Unauthorized" });
      return;
    }

    // 고유한 슬러그 생성
    let slugBase = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9가-힣ㄱ-ㅎ\s]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    let slug = slugBase;
    let counter = 1;
    while (await prisma.post.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${counter}`;
      counter++;
    }

    const choseongTitle = getChoseong(title).replace(/\s+/g, "");

    const newPost = await prisma.post.create({
      data: {
        title,
        choseongTitle,
        content,
        slug,
        ...(thumbnail && { thumbnail }),
        ...(categoryId && { categoryId: parseInt(categoryId) }),
        isPrivate,
      },
      include: {
        category: { select: { name: true, slug: true } },
        tags: { select: { name: true, slug: true } },
        _count: { select: { comments: true, postLikes: true } },
      },
    });

    // 태그 연결
    if (tags.length > 0) {
      await prisma.post.update({
        where: { id: newPost.id },
        data: {
          tags: {
            connect: tags.map((tagId: number) => ({ id: tagId })),
          },
        },
      });
    }

    const newPostWithCounts = {
      ...newPost,
      commentsCount: newPost._count.comments,
      likesCount: newPost._count.postLikes,
      isLiked: false, // 새로 생성된 포스트이므로 항상 false
      _count: undefined,
    };

    res.status(201).json({ success: true, data: newPostWithCounts });
  })
);

// POST /posts/:id/like -> 특정 포스트에 좋아요를 누름
router.post(
  "/:id/like",
  requiredAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id;
    const postId = parseInt(id);

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (!postId || isNaN(postId)) {
      res.status(400).json({ success: false, message: "Invalid post ID" });
      return;
    }

    // 트랜잭션을 사용하여 좋아요 처리와 포스트 업데이트를 원자적으로 수행
    const result = await prisma.$transaction(async (prisma) => {
      // 유저가 해당 포스트에 좋아요를 눌렀는지 확인
      const existingLike = await prisma.postLike.findUnique({
        where: {
          postId_userId: { userId, postId },
        },
      });

      let isLiked;
      let updatedPost;

      if (existingLike) {
        // 좋아요 취소
        await prisma.postLike.delete({
          where: {
            postId_userId: { userId, postId },
          },
        });

        updatedPost = await prisma.post.update({
          where: { id: postId },
          data: { likesCount: { decrement: 1 } },
          select: { id: true, title: true, likesCount: true },
        });

        isLiked = false;
      } else {
        // 좋아요 추가
        await prisma.postLike.create({
          data: {
            userId,
            postId,
          },
        });

        updatedPost = await prisma.post.update({
          where: { id: postId },
          data: { likesCount: { increment: 1 } },
          select: { id: true, title: true, likesCount: true },
        });

        isLiked = true;
      }

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

// PATCH /posts/:id -> 특정 포스트 정보를 수정
router.patch(
  "/:id",
  requiredAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { title, content, thumbnail, categoryId, isPrivate } = req.body;
    const id = Number(req.params.id);

    if (!req.user?.isOwner) {
      res.status(403).json({ success: false, message: "Unauthorized" });
      return;
    }

    // 게시글 제목 수정 시, 슬러그도 수정
    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: { slug: true, title: true },
    });

    if (!existingPost) {
      res.status(404).json({ success: false, message: "Post not found" });
      return;
    }

    let slug = existingPost.slug;
    if (title && title !== existingPost.title) {
      let slugBase = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9가-힣ㄱ-ㅎ\s]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

      slug = slugBase;
      let counter = 1;
      while (await prisma.post.findFirst({ where: { slug, id: { not: id } } })) {
        slug = `${slugBase}-${counter}`;
        counter++;
      }
    }

    const choseongTitle = title ? getChoseong(title).replace(/\s+/g, "") : undefined;

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(thumbnail !== undefined && { thumbnail: thumbnail || null }),
        ...(categoryId !== undefined && { categoryId: categoryId ? parseInt(categoryId) : null }),
        ...(isPrivate !== undefined && { isPrivate }),
        ...(choseongTitle && { choseongTitle }),
        slug,
      },
      include: {
        category: { select: { name: true, slug: true } },
        tags: { select: { name: true, slug: true } },
        _count: { select: { comments: true, postLikes: true } },
        postLikes: req.user?.id ? { where: { userId: req.user.id }, select: { id: true } } : false,
      },
    });

    const postWithCounts = {
      ...updatedPost,
      commentsCount: updatedPost._count.comments,
      likesCount: updatedPost._count.postLikes,
      isLiked: updatedPost.postLikes?.length > 0 || false,
      _count: undefined,
      postLikes: undefined,
    };

    res.json({ success: true, data: postWithCounts });
  })
);

// DELETE /posts/:id -> 특정 포스트 정보를 삭제
router.delete(
  "/:id",
  requiredAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = Number(req.params.id);

    if (!req.user?.isOwner) {
      res.status(403).json({ success: false, message: "Unauthorized" });
      return;
    }

    await prisma.post.delete({
      where: { id },
    });

    res.status(204).send();
  })
);

export default router;
