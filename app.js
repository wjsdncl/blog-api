import * as dotenv from "dotenv"; // 환경 변수 로드
dotenv.config();

import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import { getChoseong } from "es-hangul";

import multer from "multer";
import sharp from "sharp";
import path from "path";

import { createClient } from "@supabase/supabase-js";

import { assert } from "superstruct"; // 데이터 검증을 위한 라이브러리
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
    origin: ["http://localhost:3000", "https://wjsdncl-dev-hub.vercel.app"],
  })
);
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET; // JWT 시크릿 키
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET; // RefreshToken을 위한 시크릿 키 설정

/* ========================
/
/
/       Auth API
/
/
======================== */

// JWT 토큰 생성 함수
function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "3d" }); // AccessToken 3일 만료
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: "7d" }); // RefreshToken 7일 만료
  return { accessToken, refreshToken };
}

// 유저 인증 미들웨어
function requiredAuthenticate(req, res, next) {
  const token = req.headers?.authorization?.split(" ")[1];
  if (!token) return res.status(401).send({ message: "로그인이 필요합니다." });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: "토큰이 유효하지 않거나 만료되었습니다." });
    req.user = decoded;
    next();
  });
}

// 로그인 선택 미들웨어
function optionalAuthenticate(req, res, next) {
  const token = req.headers?.authorization?.split(" ")[1];
  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    req.user = err ? null : decoded;
    next();
  });
}

// POST /auth/signup -> 회원가입
app.post(
  "/auth/signup",
  asyncHandler(async (req, res) => {
    const { email, name, password } = req.body;
    assert({ email, name }, CreateUser);

    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(409).send({ message: "이미 가입된 이메일입니다." });

    // 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 6);

    // 유저 생성
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
    });

    res.status(201).send(newUser);
  })
);

// POST /auth/login -> 로그인
app.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).send({ message: "해당 이메일로 가입된 사용자가 없습니다." });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).send({ message: "비밀번호가 일치하지 않습니다." });

    const { accessToken, refreshToken } = generateTokens(user.id);
    res.send({ accessToken, refreshToken, user });
  })
);

// POST /auth/refresh -> RefreshToken을 사용하여 AccessToken 갱신
app.post(
  "/auth/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).send({ message: "리프레시 토큰이 필요합니다." });

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) return res.status(403).send({ message: "리프레시 토큰이 유효하지 않거나 만료되었습니다." });

      // 새로운 토큰 생성
      const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);
      res.send({ accessToken, refreshToken: newRefreshToken });
    });
  })
);

/* ========================
/
/
/       User API
/
/
======================== */

// GET /users -> 모든 유저 정보를 가져옴
app.get(
  "/users",
  requiredAuthenticate, // JWT 인증
  asyncHandler(async (req, res) => {
    const { offset = 0, limit = 10 } = req.query; // 페이지네이션을 위한 쿼리 파라미터

    const users = await prisma.user.findMany({
      skip: parseInt(offset),
      take: parseInt(limit),
      orderBy: { createdAt: "desc" }, // 최신 순으로 정렬
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { posts: true, comments: true } }, // 게시글 및 댓글 수 포함
        posts: { select: { category: true, title: true, content: true } }, // 유저가 작성한 포스트 정보 포함
      },
    });

    res.send(users);
  })
);

// GET /users/me -> accessToken을 사용하여 현재 유저 정보를 가져옴
app.get(
  "/users/me",
  requiredAuthenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        isAdmin: true,
        posts: {
          select: {
            _count: { select: { comments: true } },
            category: true,
            id: true,
            title: true,
            createdAt: true,
          },
        },
        comments: {
          select: {
            id: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).send({ error, message: "유저 정보를 찾을 수 없습니다." });
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

/* ========================
/
/
/       Post API
/
/
======================== */

// GET /posts -> 모든 포스트 정보를 가져옴
app.get(
  "/posts",
  asyncHandler(async (req, res) => {
    const { offset = 0, limit = 10, order = "newest", category = "", tag = "", search = "" } = req.query;

    let orderBy;
    switch (order) {
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "newest":
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
      .replace(/\s+/g, "-") // 공백을 하이픈으로
      .replace(/[^a-z0-9가-힣ㄱ-ㅎ-]/g, ""); // 특수문자 제거

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

    // 유저가 해당 포스트에 좋아요를 눌렀는지 확인
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_postId: { userId, postId },
      },
    });

    const currentPost = await prisma.post.findUnique({
      where: { id: postId },
      select: { updatedAt: true },
    });

    let isLike;

    const updateData = existingLike
      ? { likes: { decrement: 1 }, updatedAt: currentPost.updatedAt } // 좋아요 취소
      : { likes: { increment: 1 }, updatedAt: currentPost.updatedAt }; // 좋아요 추가

    // 좋아요를 토글 처리
    if (existingLike) {
      await prisma.like.delete({
        where: {
          userId_postId: { userId, postId },
        },
      });
      isLike = false;
    } else {
      await prisma.like.create({
        data: {
          userId,
          postId,
        },
      });
      isLike = true;
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: updateData,
      select: { id: true, title: true, likes: true },
    });

    res.send({ post: updatedPost, isLike });
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
        .replace(/\s+/g, "-")
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

/* ========================
/
/
/       Comment API
/
/
======================== */

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

      const repliesWithLikes = comment.replies ? await Promise.all(comment.replies.map(checkLikes)) : [];

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

/* ========================
/
/
/       File Upload API
/
/
======================== */

// Supabase 클라이언트 생성
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// 허용된 이미지 파일 형식
const ALLOWED_MIME_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

// HD 해상도 설정
const HD_RESOLUTION = { width: 1280, height: 720 };

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

  const resizedBuffer = await sharp(buffer)
    .resize(HD_RESOLUTION.width, HD_RESOLUTION.height, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
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

app.listen(8000, () => {
  console.log("Server is running on http://localhost:8000");
});
