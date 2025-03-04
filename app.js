import * as dotenv from "dotenv"; // 환경 변수 로드
dotenv.config();

import express from "express";
import jwt from "jsonwebtoken";
import cors from "cors";
import { getChoseong } from "es-hangul";
import cookieParser from "cookie-parser";

import multer from "multer";
import sharp from "sharp";
import path from "path";

import { createClient } from "@supabase/supabase-js";

import { assert, max } from "superstruct"; // 데이터 검증을 위한 라이브러리
import {
  CreateUser,
  UpdateUser,
  CreatePost,
  UpdatePost,
  CreateComment,
  UpdateComment,
  LikePost,
  LikeComment,
} from "./lib/structs.js"; // Superstruct 스키마

import crypto from "crypto"; // 랜덤 문자열 생성을 위해 crypto 모듈 사용

import { prisma } from "./lib/prismaClient.js"; // PrismaClient 인스턴스

import { asyncHandler } from "./middleware/errorHandler.js"; // 에러 핸들러 미들웨어

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://localhost:3000",
      "https://wjsdncl-dev-hub.vercel.app",
      "https://www.wjdalswo-dev.xyz",
      "https://github.com/",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ===============================================================================================
/
/
/                                        Auth Middleware
/
/
=============================================================================================== */

const JWT_SECRET = process.env.JWT_SECRET; // JWT 시크릿 키
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET; // RefreshToken을 위한 시크릿 키 설정

const DEFAULT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "none",
  path: "/",
};

// JWT 토큰 생성 함수
function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "3d" }); // AccessToken 3일 만료
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: "7d" }); // RefreshToken 7일 만료

  return { accessToken, refreshToken };
}

// 공통 인증 처리 함수
function handleAuthentication(req, res, next, isRequired) {
  const authHeader = req.headers.authorization;
  const refreshToken = req.headers["x-refresh-token"];

  if (!authHeader) {
    if (isRequired) {
      res.status(401).send({ message: "로그인이 필요합니다." });
      return;
    } else {
      req.user = null;
      next();
      return;
    }
  }

  const accessToken = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(accessToken, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError && refreshToken) {
      try {
        const refreshDecoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(
          refreshDecoded.userId
        );

        res.setHeader("Authorization", `Bearer ${newAccessToken}`);
        res.setHeader("X-Refresh-Token", newRefreshToken);

        req.user = jwt.verify(newAccessToken, JWT_SECRET);
        next();
      } catch (refreshErr) {
        if (isRequired) {
          res.status(401).send({ message: "세션이 만료되었습니다. 다시 로그인해주세요." });
        } else {
          req.user = null;
          next();
        }
      }
    } else {
      if (isRequired) {
        res.status(403).send({ message: "인증에 실패했습니다." });
      } else {
        req.user = null;
        next();
      }
    }
  }
}

// 필수 인증 미들웨어
function requiredAuthenticate(req, res, next) {
  handleAuthentication(req, res, next, true);
}

// 선택적 인증 미들웨어
function optionalAuthenticate(req, res, next) {
  handleAuthentication(req, res, next, false);
}

/* ===============================================================================================
/
/
/                                        Auth API
/
/
=============================================================================================== */

// GitHub OAuth Configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL;

// GET /auth/github -> GitHub OAuth 로그인
app.get("/auth/github", (req, res) => {
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${GITHUB_CALLBACK_URL}&scope=user:email`;
  res.redirect(githubAuthUrl);
});

// GET /auth/github/callback -> GitHub OAuth 콜백 처리
app.get(
  "/auth/github/callback",
  asyncHandler(async (req, res) => {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send({ message: "GitHub 코드를 전달받지 못했습니다." });
    }

    // GitHub access token 받기
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const { access_token } = await tokenResponse.json();

    if (!access_token) {
      return res.status(401).send({ message: "GitHub 토큰을 가져올 수 없습니다." });
    }

    // GitHub 사용자 정보 가져오기
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    // GitHub 이메일 정보 가져오기
    const emailResponse = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const githubUser = await userResponse.json();
    const emails = await emailResponse.json();

    // GitHub 사용자 정보가 없는 경우
    if (!githubUser) {
      return res.status(401).send({ message: "GitHub 사용자 정보를 가져올 수 없습니다." });
    }

    let primaryEmail;

    // 이메일 정보가 없는 경우
    if (!emails || emails.length === 0) {
      return res.status(401).send({ message: "GitHub 이메일 정보를 가져올 수 없습니다." });
    } else {
      // 기본 이메일 주소 찾기
      primaryEmail = emails.find((email) => email.primary) || emails[0];

      if (!primaryEmail) {
        return res.status(401).send({ message: "GitHub 기본 이메일 정보를 찾을 수 없습니다." });
      }
    }

    // DB에서 사용자 찾기 또는 생성
    let user = await prisma.user.findUnique({
      where: { email: primaryEmail.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: githubUser.email,
          name: githubUser.name || githubUser.login,
        },
      });
    }

    // JWT 토큰 생성 및 쿠키 설정
    const { accessToken, refreshToken } = generateTokens(user.id);

    res.status(200).send({ user, accessToken, refreshToken });
  })
);

// POST /auth/signup -> 회원가입
app.post(
  "/auth/signup",
  asyncHandler(async (req, res) => {
    const { email, name } = req.body;
    assert({ email, name }, CreateUser);

    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(409).send({ message: "이미 존재하는 사용자입니다." });

    // 유저 생성
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
      },
    });

    res.status(201).send(newUser);
  })
);

// POST /auth/login -> 로그인
app.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).send({ message: "사용자를 찾을 수 없습니다." });

    const { accessToken, refreshToken } = generateTokens(user.id);

    res.send({ user, accessToken, refreshToken });
  })
);

// POST /auth/logout -> 로그아웃
app.post("/auth/logout", (req, res) => {
  res.clearCookie("accessToken", DEFAULT_COOKIE_OPTIONS);
  res.clearCookie("refreshToken", DEFAULT_COOKIE_OPTIONS);
  res.send({ message: "로그아웃 되었습니다." });
});

/* ===============================================================================================
/
/
/                                        User API
/
/
=============================================================================================== */

// GET /users/me -> accessToken을 사용하여 현재 유저 정보를 가져옴
app.get(
  "/users/me",
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      return res.status(404).send({ message: "유저 정보를 찾을 수 없습니다." });
    }

    res.send(user);
  })
);

// PATCH /users/:id -> 특정 유저 정보를 수정
app.patch(
  "/users/:id",
  requiredAuthenticate, // JWT 인증
  asyncHandler(async (req, res) => {
    assert({ email: req.body.email, name: req.body.name }, UpdateUser); // 유효성 검사

    const { id } = req.params;

    const user = await prisma.user.update({
      where: { id },
      data: req.body,
    });

    res.send(user);
  })
);

// DELETE /users/:id -> 특정 유저 정보를 삭제
app.delete(
  "/users/:id",
  requiredAuthenticate, // JWT 인증
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id },
    });

    res.status(204).send();
  })
);

/* ===============================================================================================
/
/
/                                        Post API
/
/
=============================================================================================== */

// GET /posts -> 모든 포스트 정보를 가져옴
app.get(
  "/posts",
  asyncHandler(async (req, res) => {
    const {
      offset = 0,
      limit = 10,
      order = "newest",
      category = "",
      tag = "",
      search = "",
    } = req.query;

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
    };

    // 비동기 작업들을 병렬로 실행
    const [totalPosts, allCategoryCounts, posts] = await Promise.all([
      // 전체 포스트 개수 계산
      prisma.post.count(),

      // 카테고리 카운트 계산
      prisma.post.groupBy({
        by: ["category"],
        _count: { category: true },
      }),

      // 포스트 가져오기
      prisma.post.findMany({
        where,
        orderBy,
        skip: parseInt(offset),
        take: parseInt(limit),
        include: { _count: { select: { comments: true } } },
      }),
    ]);

    const categoryCounts = allCategoryCounts.reduce((acc, curr) => {
      if (curr.category && curr.category.trim() !== "") {
        acc[curr.category] = curr._count.category;
      }
      return acc;
    }, {});

    res.send({
      totalPosts,
      categoryCounts,
      posts,
    });
  })
);

// GET /posts/:title -> 특정 포스트 정보를 가져옴
app.get(
  "/posts/:title",
  optionalAuthenticate, // JWT 인증 (선택적)
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

    res.send(post);
  })
);

// POST /posts -> 포스트 정보를 생성
app.post(
  "/posts",
  requiredAuthenticate, // JWT 인증
  asyncHandler(async (req, res) => {
    const { title, content, userId, coverImg, category, tags = [] } = req.body;
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
        user: { connect: { id: userId } },
      },
      include: {
        user: { select: { email: true, name: true } },
      },
    });

    res.status(201).send(newPost);
  })
);

// POST /posts/:id/like -> 특정 포스트에 좋아요를 누름
app.post(
  "/posts/:id/like",
  requiredAuthenticate, // JWT 인증
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const postId = parseInt(id);

    assert({ userId, postId }, LikePost); // 유효성 검사

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

    res.send({ post: result.updatedPost, isLike: result.isLike });
  })
);

// PATCH /posts/:id -> 특정 포스트 정보를 수정
app.patch(
  "/posts/:id",
  requiredAuthenticate, // JWT 인증
  asyncHandler(async (req, res) => {
    const { title } = req.body;

    assert(req.body, UpdatePost); // 유효성 검사

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

    res.send(post);
  })
);

// DELETE /posts/:id -> 특정 포스트 정보를 삭제
app.delete(
  "/posts/:id",
  requiredAuthenticate, // JWT 인증
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    await prisma.post.delete({
      where: { id },
    });

    res.status(204).send();
  })
);

/* ===============================================================================================
/
/
/                                        Comment API
/
/
=============================================================================================== */

// GET /comments -> 모든 댓글 정보를 가져옴
app.get(
  "/comments",
  asyncHandler(async (req, res) => {
    const { offset = 0, limit = 10 } = req.query;

    const comments = await prisma.comment.findMany({
      skip: parseInt(offset),
      take: parseInt(limit),
      orderBy: { createdAt: "desc" },
      include: {
        post: { select: { title: true } },
        user: { select: { email: true, name: true } },
        replies: { include: { user: { select: { email: true, name: true } } } },
      },
    });

    res.send(comments);
  })
);

// GET /comments/:postID -> 특정 포스트의 댓글 정보를 가져옴
app.get(
  "/comments/:postId",
  optionalAuthenticate, // JWT 인증 (선택적)
  asyncHandler(async (req, res) => {
    const { offset = 0, limit = 10 } = req.query;
    const { postId } = req.params;
    const userId = req.user?.userId;

    const post = await prisma.post.findUniqueOrThrow({
      where: { id: parseInt(postId) },
      select: { id: true },
    });

    const totalComments = await prisma.comment.count({
      where: { postId: post.id },
    });

    const parentComments = await prisma.comment.count({
      where: { postId: post.id, parentCommentId: null },
    });

    const includeReplies = (depth = 10) => ({
      include:
        depth > 0
          ? {
              user: { select: { email: true, name: true } },
              replies: {
                include: {
                  user: { select: { email: true, name: true } },
                  replies: includeReplies(depth - 1),
                  _count: { select: { CommentLike: true } },
                },
              },
              _count: { select: { CommentLike: true } },
            }
          : {
              user: { select: { email: true, name: true } },
              _count: { select: { CommentLike: true } },
            },
    });

    const comments = await prisma.comment.findMany({
      skip: parseInt(offset),
      take: parseInt(limit),
      orderBy: { createdAt: "desc" },
      where: { postId: post.id, parentCommentId: null },
      ...includeReplies(),
    });

    const checkLikes = async (comment) => {
      let isLiked = false;

      // 로그인된 유저일 경우에만 좋아요 여부를 검사
      if (userId) {
        const existingLike = await prisma.commentLike.findUnique({
          where: {
            userId_commentId: { userId, commentId: comment.id },
          },
        });
        isLiked = !!existingLike;
      }

      const repliesWithLikes = comment.replies
        ? await Promise.all(comment.replies.map(checkLikes))
        : [];

      return {
        ...comment,
        isLiked,
        replies: repliesWithLikes,
      };
    };

    const commentsWithLikes = await Promise.all(comments.map(checkLikes));

    res.send({ totalComments, parentComments, comments: commentsWithLikes });
  })
);

// POST /comments -> 댓글 또는 대댓글 작성
app.post(
  "/comments",
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    assert(req.body, CreateComment); // 유효성 검사

    const { content, userId, postId, parentCommentId } = req.body;

    const newComment = await prisma.comment.create({
      data: {
        content,
        user: userId ? { connect: { id: userId } } : undefined,
        post: { connect: { id: postId } },
        parentComment: parentCommentId ? { connect: { id: parentCommentId } } : undefined, // 대댓글인 경우
      },
    });

    res.status(201).send(newComment);
  })
);

// POST /comments/:id/like -> 특정 댓글에 좋아요를 누름
app.post(
  "/comments/:id/like",
  requiredAuthenticate, // JWT 인증
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const commentId = parseInt(id);

    assert({ userId, commentId }, LikeComment); // 유효성 검사

    // 유저가 해당 댓글에 좋아요를 눌렀는지 확인
    const existingLike = await prisma.commentLike.findUnique({
      where: {
        userId_commentId: { userId, commentId },
      },
    });

    let isLike; // 좋아요 상태를 나타낼 boolean 변수

    const updateData = existingLike
      ? { likes: { decrement: 1 } } // 좋아요 취소
      : { likes: { increment: 1 } }; // 좋아요 추가

    // 좋아요를 토글 처리
    if (existingLike) {
      await prisma.commentLike.delete({
        where: {
          userId_commentId: { userId, commentId },
        },
      });
      isLike = false; // 좋아요 취소
    } else {
      await prisma.commentLike.create({
        data: {
          userId,
          commentId,
        },
      });
      isLike = true; // 좋아요 추가
    }

    // 업데이트 후 댓글 데이터에서 필요한 필드만 선택해서 응답
    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: updateData,
      select: { id: true, content: true, likes: true }, // 필요한 필드만 선택
    });

    res.send({
      comment: updatedComment, // 필요한 필드만 전송
      isLike, // 좋아요 상태 전송
    });
  })
);

// PATCH /comments/:id -> 특정 댓글을 수정
app.patch(
  "/comments/:id",
  requiredAuthenticate, // JWT 인증
  asyncHandler(async (req, res) => {
    assert(req.body, UpdateComment); // 유효성 검사

    const id = Number(req.params.id);

    const comment = await prisma.comment.update({
      where: { id },
      data: req.body,
    });

    res.send(comment);
  })
);

// DELETE /comments/:id -> 댓글 삭제
app.delete(
  "/comments/:id",
  requiredAuthenticate, // JWT 인증
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 삭제할 댓글이 존재하는지 확인
    const comment = await prisma.comment.findUnique({
      where: { id: parseInt(id) },
      include: {
        replies: true,
      },
    });

    if (!comment) {
      return res.status(404).send({ message: "댓글을 찾을 수 없습니다." });
    }

    // 댓글에 답글이 있는지 확인
    if (comment.replies.length > 0) {
      // 답글이 있을 경우, 내용만 지우고 구조 유지
      await prisma.comment.update({
        where: { id: parseInt(id) },
        data: {
          content: "[삭제된 댓글입니다]", // 댓글 내용 삭제
          likes: 0, // 좋아요 수 초기화
          userId: null, // 유저 정보 삭제
        },
      });
    } else {
      // 답글이 없을 경우, 댓글을 완전히 삭제
      await prisma.comment.delete({
        where: { id: parseInt(id) },
      });
    }

    res.status(204).send();
  })
);

/* ===============================================================================================
/
/
/                                     Image Upload API
/
/
=============================================================================================== */

// Supabase 클라이언트 생성
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// 허용된 이미지 파일 형식
const ALLOWED_MIME_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

// Multer 설정 (파일 업로드 미들웨어)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error("허용된 이미지 파일 형식만 업로드할 수 있습니다."), false);
    }
  },
});

// 이미지 처리 및 Supabase에 업로드 함수
async function processAndUploadImage(buffer, originalName) {
  const baseName = path.basename(originalName, path.extname(originalName));
  const filename = `${Date.now()}-${baseName}.webp`;

  // 이미지 메타데이터를 읽어서 원본 크기 확인
  const metadata = await sharp(buffer).metadata();
  const { width: originalWidth, height: originalHeight } = metadata;

  if (!originalWidth || !originalHeight) {
    throw new Error("이미지 메타데이터를 읽어올 수 없습니다.");
  }

  // 가로/세로 비율에 따라 리사이징 옵션 설정
  let resizeOptions;
  if (originalWidth >= originalHeight) {
    // 가로가 더 길거나 같은 경우
    resizeOptions = {
      width: 1280,
      height: Math.round((1280 * originalHeight) / originalWidth),
    };
  } else {
    // 세로가 더 긴 경우
    resizeOptions = {
      width: Math.round((1280 * originalWidth) / originalHeight),
      height: 1280,
    };
  }

  const resizedBuffer = await sharp(buffer)
    .resize(resizeOptions.width, resizeOptions.height, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 90 })
    .toBuffer();

  const { data, error } = await supabase.storage
    .from("images")
    .upload(filename, resizedBuffer, { contentType: "image/webp" });

  if (error) throw new Error(`이미지 업로드 중 에러 발생: ${error.message}`);

  const result = supabase.storage.from("images").getPublicUrl(data.path);
  return result.data.publicUrl;
}

// POST /upload -> 이미지 업로드 API
app.post(
  "/upload",
  requiredAuthenticate,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "이미지 파일을 업로드하세요." });
    }

    // HD 해상도로 이미지 처리 및 업로드
    const url = await processAndUploadImage(req.file.buffer, req.file.originalname);

    res.send({
      success: true,
      url,
    });
  })
);

/* ===============================================================================================
/
/
/                                     Project API
/
/
=============================================================================================== */

// GET /projects -> 모든 프로젝트 정보 가져오기
app.get(
  "/projects",
  asyncHandler(async (req, res) => {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.send(projects);
  })
);

// GET /projects/:id -> 특정 프로젝트 정보 가져오기
app.get(
  "/projects/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: Number(id) },
    });

    res.send(project);
  })
);

// POST /projects -> 새로운 프로젝트 생성
app.post(
  "/projects",
  asyncHandler(async (req, res) => {
    const {
      title,
      isPersonal,
      startDate,
      endDate,
      description,
      content,
      summary,
      techStack,
      githubLink,
      projectLink,
    } = req.body;

    const newProject = await prisma.project.create({
      data: {
        title,
        isPersonal,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        description,
        content,
        summary,
        techStack,
        githubLink,
        projectLink,
      },
    });

    res.status(201).send(newProject);
  })
);

// PATCH /projects/:id -> 특정 프로젝트 정보 수정
app.patch(
  "/projects/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const updatedProject = await prisma.project.update({
      where: { id: Number(id) },
      data: req.body,
    });

    res.send(updatedProject);
  })
);

// DELETE /projects/:id -> 특정 프로젝트 삭제
app.delete(
  "/projects/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await prisma.project.delete({
      where: { id: Number(id) },
    });

    res.status(204).send({ success: true });
  })
);

app.listen(8000, () => {
  console.log("Server is running on http://localhost:8000");
});
