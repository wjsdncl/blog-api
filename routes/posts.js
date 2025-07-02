import express from "express";
import { assert } from "superstruct";
import { getChoseong } from "es-hangul";
import crypto from "crypto";
import { CreatePost, UpdatePost, LikePost } from "../lib/structs.js";
import { prisma } from "../lib/prismaClient.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requiredAuthenticate, optionalAuthenticate } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

// GET /posts -> 모든 포스트 정보를 가져옴
router.get(
  "/",
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { offset = 0, limit = 10, order = "newest", category = "", tag = "", search = "" } = req.query;

    let orderBy;
    switch (order) {
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "newest":
        orderBy = { createdAt: "desc" };
        break;
      case "like":
        orderBy = { likes: "desc" };
        break;
      default:
        orderBy = { createdAt: "desc" };
    }

    const userId = req.user?.userId;
    const isAdmin = req.user?.isAdmin;

    // 검색 조건 설정
    const where = {
      ...(category && { category }),
      ...(tag && { tags: { has: tag } }),
      ...(search && {
        choseongTitle: {
          contains: getChoseong(search).replace(/\s+/g, ""),
          mode: "insensitive",
        },
      }),
      // 비공개 글 필터링:
      // - 관리자는 모든 글을 볼 수 있음
      // - 로그인한 사용자는 자신의 글(비공개 포함) + 타인의 공개 글만 볼 수 있음
      // - 비로그인 사용자는 공개 글만 볼 수 있음
      ...(!isAdmin && {
        ...(!userId
          ? { isPrivate: false }
          : {
              OR: [{ userId: userId }, { isPrivate: false }],
            }),
      }),
    };

    // 비동기 작업들을 병렬로 실행
    const [totalPosts, allCategoryCounts, posts] = await Promise.all([
      // 항상 모든 공개 게시글 수를 계산
      prisma.post.count({ where: { isPrivate: false } }),

      // 항상 모든 공개 게시글의 카테고리 카운트 계산
      prisma.post.groupBy({
        by: ["category"],
        _count: { category: true },
        where: { isPrivate: false },
      }),

      // 포스트 가져오기
      prisma.post.findMany({
        where,
        orderBy,
        skip: parseInt(offset),
        take: parseInt(limit),
        include: {
          _count: { select: { comments: true } },
          user: { select: { name: true } },
        },
      }),
    ]);

    const categoryCounts = allCategoryCounts.reduce((acc, curr) => {
      if (curr.category && curr.category.trim() !== "") {
        acc[curr.category] = curr._count.category;
      }
      return acc;
    }, {});

    logger.info("Posts fetched", {
      count: posts.length,
      totalPosts,
      userId: userId || "anonymous",
    });

    res.json({
      success: true,
      data: {
        totalPosts,
        categoryCounts,
        posts,
      },
      meta: {
        pagination: {
          offset: parseInt(offset),
          limit: parseInt(limit),
          total: totalPosts,
        },
      },
    });
  })
);

// GET /posts/:title -> 특정 포스트 정보를 가져옴
router.get(
  "/:title",
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { title } = req.params;
    const userId = req.user?.userId;

    const post = await prisma.post.findUniqueOrThrow({
      where: { slug: title },
      include: {
        user: { select: { id: true, email: true, name: true } },
        _count: { select: { comments: true, Like: true } },
      },
    });

    post.isLiked = false;

    // 로그인된 유저일 경우에만 좋아요 여부를 검사
    if (userId) {
      const existingLike = await prisma.like.findUnique({
        where: {
          userId_postId: { userId, postId: post.id },
        },
      });
      post.isLiked = !!existingLike;
    }

    logger.info("Post viewed", {
      postId: post.id,
      slug: title,
      userId: userId || "anonymous",
    });

    res.json({
      success: true,
      data: post,
    });
  })
);

// POST /posts -> 포스트 정보를 생성
router.post(
  "/",
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    const { title, content, userId, coverImg, category, tags = [], isPrivate = false } = req.body;
    assert(req.body, CreatePost);

    // 고유한 슬러그 생성
    let slugBase = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9가-힣ㄱ-ㅎ\s]/g, "") // 특수문자 제거 (공백 유지)
      .replace(/\s+/g, "-") // 공백을 하이픈으로
      .replace(/-+/g, "-"); // 연속된 하이픈을 하나로

    let slug = `${slugBase}`;
    while (await prisma.post.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${crypto.randomBytes(2).toString("hex").slice(0, 3)}`;
    }

    const choseongTitle = getChoseong(title).replace(/\s+/g, "");

    const newPost = await prisma.post.create({
      data: {
        title,
        choseongTitle,
        content,
        slug,
        coverImg: coverImg === "" ? null : coverImg,
        category: category === "" ? null : category,
        tags,
        isPrivate,
        user: { connect: { id: userId } },
      },
      include: {
        user: { select: { email: true, name: true } },
      },
    });

    logger.info("Post created", {
      postId: newPost.id,
      title,
      userId,
      isPrivate,
    });

    res.status(201).json({
      success: true,
      data: newPost,
    });
  })
);

// POST /posts/:id/like -> 특정 포스트에 좋아요를 누름
router.post(
  "/:id/like",
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const postId = parseInt(id);

    assert({ userId, postId }, LikePost);

    // 트랜잭션을 사용하여 좋아요 처리와 포스트 업데이트를 원자적으로 수행
    const result = await prisma.$transaction(async (prisma) => {
      // 유저가 해당 포스트에 좋아요를 눌렀는지 확인
      const existingLike = await prisma.like.findUnique({
        where: {
          userId_postId: { userId, postId },
        },
      });

      let isLike;
      let updatedPost;

      if (existingLike) {
        // 좋아요 취소
        await prisma.like.delete({
          where: {
            userId_postId: { userId, postId },
          },
        });

        updatedPost = await prisma.post.update({
          where: { id: postId },
          data: { likes: { decrement: 1 } },
          select: { id: true, title: true, likes: true },
        });

        isLike = false;
      } else {
        // 좋아요 추가
        await prisma.like.create({
          data: {
            userId,
            postId,
          },
        });

        updatedPost = await prisma.post.update({
          where: { id: postId },
          data: { likes: { increment: 1 } },
          select: { id: true, title: true, likes: true },
        });

        isLike = true;
      }

      return { updatedPost, isLike };
    });

    logger.info("Post like toggled", {
      postId,
      userId,
      isLike: result.isLike,
    });

    res.json({
      success: true,
      data: {
        post: result.updatedPost,
        isLike: result.isLike,
      },
    });
  })
);

// PATCH /posts/:id -> 특정 포스트 정보를 수정
router.patch(
  "/:id",
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    const { title } = req.body;
    assert(req.body, UpdatePost);

    const id = Number(req.params.id);

    // 게시글 제목 수정 시, 슬러그도 수정
    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: { slug: true, title: true },
    });

    let slug;
    if (title && title !== existingPost.title) {
      let slugBase = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9가-힣ㄱ-ㅎ\s]/g, "")
        .replace(/-/g, "") // 하이픈 제거
        .replace(/\s+/g, "-") // 공백을 하이픈으로
        .replace(/[^a-z0-9가-힣ㄱ-ㅎ-]/g, "");

      slug = `${slugBase}`;
      while (await prisma.post.findFirst({ where: { slug } })) {
        slug = `${slugBase}-${crypto.randomBytes(2).toString("hex").slice(0, 3)}`;
      }
    } else {
      slug = existingPost.slug;
    }

    const choseongTitle = title ? getChoseong(title).replace(/\s+/g, "") : undefined;

    const post = await prisma.post.update({
      where: { id },
      data: {
        ...req.body,
        ...(choseongTitle && { choseongTitle }),
        ...(slug && { slug }),
      },
    });

    logger.info("Post updated", { postId: id, userId: req.user.userId });

    res.json({
      success: true,
      data: post,
    });
  })
);

// DELETE /posts/:id -> 특정 포스트 정보를 삭제
router.delete(
  "/:id",
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    await prisma.post.delete({
      where: { id },
    });

    logger.info("Post deleted", { postId: id, userId: req.user.userId });

    res.status(204).send();
  })
);

export default router;
