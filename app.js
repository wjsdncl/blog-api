import * as dotenv from "dotenv"; // 환경 변수 로드
dotenv.config();

import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import { PrismaClient, Prisma } from "@prisma/client"; // Prisma Client를 가져옵니다.

import { assert } from "superstruct"; // 데이터 검증을 위한 라이브러리
import { CreateUser, UpdateUser, CreatePost, UpdatePost, CreateComment, UpdateComment } from "./structs.js"; // Superstruct 스키마

import crypto from "crypto"; // 랜덤 문자열 생성을 위해 crypto 모듈 사용

const prisma = new PrismaClient(); // Prisma Client 인스턴스 생성

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "https://wjsdncl-dev-hub.vercel.app/"],
  })
);
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET; // JWT 시크릿 키
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET; // RefreshToken을 위한 시크릿 키 설정

/* ========================
/
/
/       Error Handler
/
/
======================== */

// 에러 핸들러를 생성하는 함수
function asyncHandler(handler) {
  return async function (req, res) {
    try {
      await handler(req, res);
    } catch (e) {
      // Superstruct 검증 오류 및 Prisma Client 검증 오류 처리
      if (e.name === "StructError" || e instanceof Prisma.PrismaClientValidationError) {
        res.status(400).send({ message: e.message ?? "Bad Request: Invalid input data." });
      }
      // Prisma에서 발생하는 요청 오류 처리
      else if (e instanceof Prisma.PrismaClientKnownRequestError) {
        switch (e.code) {
          case "P2025": // 리소스를 찾을 수 없을 때
            res.status(404).send({ message: "Resource not found." });
            break;
          case "P2002": // 고유 제약 조건 위반 시
            console.error("Unique constraint failed on:", e.meta?.target); // 오류 발생 필드 확인
            res.status(409).send({ message: `Unique constraint failed on: ${e.meta?.target || "unknown field"}` });
            break;
          default: // 기타 Prisma에서 발생하는 요청 오류
            res.status(400).send({ message: e.message ?? "Bad Request: Known error." });
        }
      } else if (e instanceof jwt.JsonWebTokenError || e.name === "JsonWebTokenError") {
        // JWT 토큰 관련 오류 처리
        res.status(401).send({ message: "Unauthorized: Invalid token." });
      } else {
        // 기타 내부 서버 오류 처리
        res.status(500).send({ message: e.message ?? "Internal Server Error." });
      }
    }
  };
}

/* ========================
/
/
/       Auth API
/
/
======================== */

// JWT 토큰 생성 함수
function generateTokens(user) {
  const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "3d" }); // AccessToken 3일 만료
  const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: "7d" }); // RefreshToken 7일 만료
  return { accessToken, refreshToken };
}

// 유저 인증 미들웨어
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).send({ message: "접근이 거부되었습니다. 토큰이 없습니다." });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: "토큰이 유효하지 않거나 만료되었습니다." });
    req.user = decoded;
    next();
  });
}

// POST /auth/signup -> 회원가입
app.post(
  "/auth/signup",
  asyncHandler(async (req, res) => {
    const { email, name, password } = req.body;
    assert({ email, name }, CreateUser);

    // 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 유저 생성
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
    });

    res.status(201).send({ data: newUser, message: "성공적으로 가입되었습니다." });
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

    const { accessToken, refreshToken } = generateTokens(user);
    res.send({ accessToken, refreshToken, user, message: "성공적으로 로그인되었습니다." });
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
      res.send({ accessToken, refreshToken: newRefreshToken, message: "토큰이 성공적으로 갱신되었습니다." });
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
  authenticateToken, // JWT 인증
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

    res.send({ data: users, message: "유저 목록을 성공적으로 가져왔습니다." });
  })
);

// GET /users/me -> accessToken을 사용하여 현재 유저 정보를 가져옴
app.get(
  "/users/me",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
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
      return res.status(404).send({ message: "유저 정보를 찾을 수 없습니다." });
    }

    res.send({ data: user, message: "유저 정보를 성공적으로 가져왔습니다." });
  })
);

// PATCH /users/:id -> 특정 유저 정보를 수정
app.patch(
  "/users/:id",
  authenticateToken, // JWT 인증
  asyncHandler(async (req, res) => {
    assert(req.body, UpdateUser); // 유효성 검사

    const { id } = req.params;

    const user = await prisma.user.update({
      where: { id },
      data: req.body,
    });

    res.send({ data: user, message: "유저 정보가 성공적으로 수정되었습니다." });
  })
);

// DELETE /users/:id -> 특정 유저 정보를 삭제
app.delete(
  "/users/:id",
  authenticateToken, // JWT 인증
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id },
    });

    res.status(204).send({ message: "유저가 성공적으로 삭제되었습니다." });
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
    const { offset = 0, limit = 10, order = "newest" } = req.query; // 페이지네이션 및 정렬 옵션

    let orderBy;
    switch (order) {
      case "oldest":
        orderBy = { createdAt: "asc" }; // 오래된 순 정렬
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" }; // 최신 순 정렬
    }

    const totalPosts = await prisma.post.count();

    const posts = await prisma.post.findMany({
      orderBy,
      skip: parseInt(offset),
      take: parseInt(limit),
      include: { _count: { select: { comments: true } } }, // 댓글 수 포함
    });

    res.send({ totalPosts, posts, message: "포스트 목록을 성공적으로 가져왔습니다." });
  })
);

// GET /posts/:title -> 특정 포스트 정보를 가져옴
app.get(
  "/posts/:title",
  asyncHandler(async (req, res) => {
    const { title } = req.params;

    const post = await prisma.post.findUniqueOrThrow({
      where: { slug: title }, // 슬러그를 이용한 조회
    });

    res.send({ data: post, message: "포스트를 성공적으로 가져왔습니다." });
  })
);

// POST /posts -> 포스트 정보를 생성
app.post(
  "/posts",
  authenticateToken, // JWT 인증
  asyncHandler(async (req, res) => {
    const { title, content, userId, coverImg, category, tags } = req.body;
    assert({ title, content, userId }, CreatePost); // Superstruct를 사용한 유효성 검사

    // 고유한 슬러그 생성
    let slugBase =
      title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9가-힣-]/g, "") || "untitled";

    let slug = `${slugBase}`;

    while (await prisma.post.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${crypto.randomBytes(2).toString("hex").slice(0, 3)}`;
    }

    const newPost = await prisma.post.create({
      data: { title, content, slug, coverImg, category, tags, user: { connect: { id: userId } } },
      include: {
        user: { select: { email: true, name: true } },
        comments: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            include: {
              user: { select: { email: true, name: true } },
              replies: {
                include: { user: { select: { email: true, name: true } } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    res.status(201).send({ data: newPost, message: "포스트가 성공적으로 생성되었습니다." });
  })
);

// PATCH /posts/:id -> 특정 포스트 정보를 수정
app.patch(
  "/posts/:id",
  authenticateToken, // JWT 인증
  asyncHandler(async (req, res) => {
    assert(req.body, UpdatePost); // 유효성 검사

    const { id } = req.params;

    const post = await prisma.post.update({
      where: { id },
      data: req.body,
    });

    res.send({ data: post, message: "포스트가 성공적으로 수정되었습니다." });
  })
);

// DELETE /posts/:id -> 특정 포스트 정보를 삭제
app.delete(
  "/posts/:id",
  authenticateToken, // JWT 인증
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await prisma.post.delete({
      where: { id },
    });

    res.status(204).send({ message: "포스트가 성공적으로 삭제되었습니다." });
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
    const { offset = 0, limit = 10 } = req.query; // 페이지네이션을 위한 쿼리 파라미터

    const comments = await prisma.comment.findMany({
      skip: parseInt(offset),
      take: parseInt(limit),
      orderBy: { createdAt: "desc" }, // 최신 순으로 정렬
      include: {
        post: { select: { title: true } }, // 포스트 제목 포함
        user: { select: { email: true, name: true } }, // 댓글 작성자 정보 포함
        replies: { include: { user: { select: { email: true, name: true } } } }, // 대댓글 작성자 정보 포함
      },
    });

    res.send(comments);
  })
);

// GET /comments/:title -> 특정 포스트의 댓글 정보를 가져옴
app.get(
  "/comments/:title",
  asyncHandler(async (req, res) => {
    const { title } = req.params;

    const post = await prisma.post.findUniqueOrThrow({
      where: { slug: title }, // 포스트의 슬러그를 이용하여 조회
      select: { id: true },
    });

    // 특정 포스트의 총 댓글 수를 가져옵니다.
    const totalComments = await prisma.comment.count({ where: { postId: post.id } });

    const comments = await prisma.comment.findMany({
      where: { postId: post.id },
      include: {
        user: { select: { email: true, name: true } }, // 댓글 작성자 정보 포함
        replies: { include: { user: { select: { email: true, name: true } } } }, // 대댓글 작성자 정보 포함
      },
    });

    res.send({ totalComments, comments });
  })
);

// POST /comments -> 댓글 또는 대댓글 작성
app.post(
  "/comments",
  authenticateToken, // JWT 인증
  asyncHandler(async (req, res) => {
    assert(req.body, CreateComment); // 유효성 검사

    const { content, userId, postId, parentCommentId } = req.body;

    const newComment = await prisma.comment.create({
      data: {
        content,
        user: userId ? { connect: { id: userId } } : undefined, // userId가 있는 경우 유저 연결
        post: { connect: { id: postId } }, // postId를 이용하여 포스트 연결
        parentComment: parentCommentId ? { connect: { id: parentCommentId } } : undefined, // 대댓글의 경우 부모 댓글 연결
      },
      include: {
        user: { select: { email: true, name: true } },
        post: { select: { title: true } },
        parentComment: { select: { id: true, content: true } },
      },
    });

    res.status(201).send({ data: newComment, message: "댓글이 성공적으로 작성되었습니다." });
  })
);

// PATCH /comments/:id -> 특정 댓글을 수정
app.patch(
  "/comments/:id",
  authenticateToken, // JWT 인증
  asyncHandler(async (req, res) => {
    assert(req.body, UpdateComment); // 유효성 검사

    const { id } = req.params;

    const comment = await prisma.comment.update({
      where: { id },
      data: req.body,
    });

    res.send({ data: comment, message: "댓글이 성공적으로 수정되었습니다." });
  })
);

// DELETE /comments/:id -> 특정 댓글을 삭제
app.delete(
  "/comments/:id",
  authenticateToken, // JWT 인증
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await prisma.comment.delete({
      where: { id },
    });

    res.status(204).send({ message: "댓글이 성공적으로 삭제되었습니다." });
  })
);

app.listen(8000, () => console.log("Server Started"));
