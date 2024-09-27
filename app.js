import * as dotenv from "dotenv"; // 환경 변수 로드
dotenv.config();

import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import { getChoseong } from "es-hangul";

import { PrismaClient, Prisma } from "@prisma/client"; // Prisma Client를 가져옵니다.

import { assert } from "superstruct"; // 데이터 검증을 위한 라이브러리
import { CreateUser, UpdateUser, CreatePost, UpdatePost, CreateComment, UpdateComment } from "./structs.js"; // Superstruct 스키마

import crypto from "crypto"; // 랜덤 문자열 생성을 위해 crypto 모듈 사용

const prisma = new PrismaClient(); // Prisma Client 인스턴스 생성

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
      if (e.name === "StructError") {
        // Superstruct 검증 오류
        res.status(400).send({
          message: `입력 데이터 오류: ${e.key} 필드가 올바르지 않습니다. ${e.message}`,
        });
      } else if (e instanceof Prisma.PrismaClientValidationError) {
        // Prisma Client 검증 오류
        res.status(400).send({
          message: `입력 데이터 오류: ${e.message} 필드가 올바르지 않습니다.`,
        });
      } else if (e instanceof Prisma.PrismaClientKnownRequestError) {
        // Prisma에서 발생하는 요청 오류 처리
        switch (e.code) {
          case "P2025": // 리소스를 찾을 수 없을 때
            res.status(404).send({
              message: "리소스를 찾을 수 없습니다. 요청한 데이터가 존재하지 않습니다.",
            });
            break;
          case "P2002": // 고유 제약 조건 위반 시
            res.status(409).send({
              message: `중복된 데이터 오류: ${e.meta?.target || "알 수 없는 필드"}에 중복된 값이 있습니다.`,
            });
            break;
          default: // 기타 Prisma에서 발생하는 요청 오류
            res.status(400).send({
              message: `알려진 오류: ${e.message}. 요청을 확인하고 다시 시도하십시오.`,
            });
        }
      } else if (e instanceof jwt.JsonWebTokenError || e.name === "JsonWebTokenError") {
        // JWT 토큰 관련 오류 처리
        res.status(401).send({
          message: "인증 오류: 유효하지 않거나 만료된 토큰입니다.",
        });
      } else {
        // 기타 내부 서버 오류 처리
        console.error("Unhandled Error:", e); // 추가적으로 콘솔에 상세 오류를 로깅
        res.status(500).send({
          message: `서버 오류: ${e.message}. 문제가 계속되면 관리자에게 문의하세요.`,
        });
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

    const { accessToken, refreshToken } = generateTokens(user);
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

    res.send(users);
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
  authenticateToken, // JWT 인증
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
  authenticateToken, // JWT 인증
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
    const { offset = 0, limit = 10, order = "newest", category = "", search = "" } = req.query;

    let orderBy;
    switch (order) {
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
    }

    // 전체 포스트 개수 계산
    const totalPosts = await prisma.post.count();

    // 카테고리 카운트 계산
    const allCategoryCounts = await prisma.post.groupBy({
      by: ["category"],
      _count: { category: true },
    });

    const categoryCounts = allCategoryCounts.reduce((acc, curr) => {
      if (curr.category && curr.category.trim() !== "") {
        acc[curr.category] = curr._count.category;
      }
      return acc;
    }, {});

    // 검색 조건 설정
    const where = {
      ...(category && { category }),
      ...(search && {
        choseongTitle: {
          contains: getChoseong(search).replace(/\s+/g, ""),
          mode: "insensitive",
        },
      }),
    };

    // 검색된 포스트 가져오기
    const posts = await prisma.post.findMany({
      where,
      orderBy,
      skip: parseInt(offset),
      take: parseInt(limit),
      include: { _count: { select: { comments: true } } },
    });

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
  asyncHandler(async (req, res) => {
    const { title } = req.params;

    const post = await prisma.post.findUniqueOrThrow({
      where: { slug: title }, // 슬러그를 이용한 조회
    });

    res.send(post);
  })
);

// POST /posts -> 포스트 정보를 생성
app.post(
  "/posts",
  authenticateToken, // JWT 인증
  asyncHandler(async (req, res) => {
    const { title, content, userId, coverImg, category, tags = [] } = req.body;
    assert({ title, content, userId }, CreatePost);

    // 고유한 슬러그 생성
    let slugBase = title
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9가-힣ㄱ-ㅎ-]/g, "");

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

// PATCH /posts/:id -> 특정 포스트 정보를 수정
app.patch(
  "/posts/:id",
  authenticateToken, // JWT 인증
  asyncHandler(async (req, res) => {
    const { title } = req.body;

    // 수정된 제목이 있을 경우 choseongTitle 업데이트
    const choseongTitle = title ? getChoseong(title).replace(/\s+/g, "") : undefined;

    const id = Number(req.params.id);

    const post = await prisma.post.update({
      where: { id },
      data: {
        ...req.body,
        ...(choseongTitle && { choseongTitle }), // 초성 저장
      },
    });

    res.send(post);
  })
);

// DELETE /posts/:id -> 특정 포스트 정보를 삭제
app.delete(
  "/posts/:id",
  authenticateToken, // JWT 인증
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

    res.status(201).send(newComment);
  })
);

// PATCH /comments/:id -> 특정 댓글을 수정
app.patch(
  "/comments/:id",
  authenticateToken, // JWT 인증
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

// DELETE /comments/:id -> 특정 댓글을 삭제
app.delete(
  "/comments/:id",
  authenticateToken, // JWT 인증
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    await prisma.comment.delete({
      where: { id },
    });

    res.status(204).send();
  })
);

app.listen(8000, () => console.log("Server Started"));
