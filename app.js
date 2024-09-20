import * as dotenv from "dotenv"; // 환경 변수 로드
dotenv.config();

import express from "express";
import { PrismaClient, Prisma } from "@prisma/client"; // Prisma Client를 가져옵니다.

import { assert } from "superstruct"; // 데이터 검증을 위한 라이브러리
import { CreateUser, UpdateUser, CreatePost, UpdatePost, CreateComment, UpdateComment } from "./structs.js"; // Superstruct 스키마

import crypto from "crypto"; // 랜덤 문자열 생성을 위해 crypto 모듈 사용

const prisma = new PrismaClient(); // Prisma Client 인스턴스 생성

const app = express();
app.use(express.json()); // JSON 요청 파싱 미들웨어

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
      } else {
        // 기타 내부 서버 오류 처리
        res.status(500).send({ message: e.message ?? "Internal Server Error." });
      }
    }
  };
}

/* ========================
  User API
======================== */

// GET /users -> 모든 유저 정보를 가져옴
app.get(
  "/users",
  asyncHandler(async (req, res) => {
    const { offset = 0, limit = 10 } = req.query; // 페이지네이션을 위한 쿼리 파라미터

    const users = await prisma.user.findMany({
      skip: parseInt(offset),
      take: parseInt(limit),
      orderBy: { createdAt: "desc" }, // 최신 순으로 정렬
      include: {
        _count: { select: { posts: true, comments: true } }, // 게시글 및 댓글 수 포함
        posts: { select: { category: true, title: true, content: true } }, // 유저가 작성한 포스트 정보 포함
        comments: { select: { content: true } }, // 유저가 작성한 댓글 정보 포함
      },
    });

    // 포스트와 댓글의 길이를 제한하여 수정
    const modifiedUsers = users.map((user) => ({
      ...user,
      posts: user.posts.map((post) => ({
        ...post,
        content: post.content.length > 120 ? post.content.slice(0, 120) + "..." : post.content,
      })),
      comments: user.comments.map((comment) => ({
        ...comment,
        content: comment.content.length > 120 ? comment.content.slice(0, 120) + "..." : comment.content,
      })),
    }));

    res.send(modifiedUsers);
  })
);

// GET /users/:id -> 특정 유저 정보를 가져옴
app.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await prisma.user.findUniqueOrThrow({
      where: { id },
      include: {
        _count: { select: { posts: true, comments: true } }, // 게시글 및 댓글 수 포함
        posts: {
          select: {
            _count: { select: { comments: true } }, // 댓글 수 포함
            category: true,
            title: true,
            content: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        comments: { select: { content: true, createdAt: true } }, // 댓글 정보 포함
      },
    });

    // 포스트 내용 길이 제한하여 수정
    const modifiedUser = {
      ...user,
      posts: user.posts.map((post) => ({
        ...post,
        content: post.content.length > 120 ? post.content.slice(0, 120) + "..." : post.content,
      })),
    };

    res.send(modifiedUser);
  })
);

// POST /users -> 유저 정보를 생성
app.post(
  "/users",
  asyncHandler(async (req, res) => {
    assert(req.body, CreateUser); // 유효성 검사

    const user = await prisma.user.create({
      data: req.body,
    });

    res.status(201).send(user);
  })
);

// PATCH /users/:id -> 특정 유저 정보를 수정
app.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    assert(req.body, UpdateUser); // 유효성 검사

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
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id },
    });

    res.sendStatus(204); // No Content 응답
  })
);

/* ========================
  Post API
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

    // 총 post 개수를 가져옵니다.
    const totalPosts = await prisma.post.count();

    const posts = await prisma.post.findMany({
      orderBy,
      skip: parseInt(offset),
      take: parseInt(limit),
      include: { _count: { select: { comments: true } } }, // 댓글 수 포함
    });

    // 카테고리별 개수를 계산합니다.
    const categoryCounts = {};
    posts.forEach((post) => {
      if (post.category) {
        categoryCounts[post.category] = (categoryCounts[post.category] || 0) + 1;
      }
    });

    // content의 길이를 제한합니다.
    const modifiedPosts = posts.map((post) => ({
      ...post,
      content: post.content.length > 120 ? post.content.slice(0, 120) + "..." : post.content,
    }));

    res.send({ totalPosts, categoryCounts, posts: modifiedPosts });
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
  asyncHandler(async (req, res) => {
    const { title, content, userId, coverImg, category, tags } = req.body;
    assert({ title, content, userId }, CreatePost); // Superstruct를 사용한 유효성 검사

    // 슬러그 생성: 한글, 영어, 숫자, 하이픈만 남기고 공백을 '-'로 변경
    let slugBase =
      title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9가-힣-]/g, "") || "untitled"; // 기본값 설정

    // 3자 랜덤 문자열 생성
    const randomString = crypto.randomBytes(2).toString("hex").slice(0, 3); // 3자 랜덤 문자열 생성

    // 슬러그에 랜덤 문자열 추가
    let slug = `${slugBase}-${randomString}`;

    // 고유한 슬러그 생성
    while (await prisma.post.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${crypto.randomBytes(2).toString("hex").slice(0, 3)}`;
    }

    // 포스트 생성
    const newPost = await prisma.post.create({
      data: { title, content, slug, coverImg, category, tags, user: { connect: { id: userId } } },
      include: {
        user: { select: { email: true, name: true } },
        comments: { select: { id: true, content: true, createdAt: true } },
      },
    });

    res.status(201).send(newPost);
  })
);

// PATCH /posts/:id -> 특정 포스트 정보를 수정
app.patch(
  "/posts/:id",
  asyncHandler(async (req, res) => {
    assert(req.body, UpdatePost); // 유효성 검사

    const { id } = req.params;

    const post = await prisma.post.update({
      where: { id },
      data: req.body,
    });

    res.send(post);
  })
);

// DELETE /posts/:id -> 특정 포스트 정보를 삭제
app.delete(
  "/posts/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await prisma.post.delete({
      where: { id },
    });

    res.sendStatus(204); // No Content 응답
  })
);

/* ========================
  Comment API
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
  asyncHandler(async (req, res) => {
    assert(req.body, CreateComment); // 유효성 검사

    const { content, userId, postId, parentCommentId } = req.body;

    // 댓글 또는 대댓글 생성
    const newComment = await prisma.comment.create({
      data: {
        content,
        user: userId ? { connect: { id: userId } } : undefined, // userId가 있는 경우 유저 연결
        post: { connect: { id: postId } }, // postId를 이용하여 포스트 연결
        parentComment: parentCommentId ? { connect: { id: parentCommentId } } : undefined, // 대댓글의 경우 부모 댓글 연결
      },
      include: {
        user: { select: { email: true, name: true } }, // 댓글 작성자 정보 포함
        post: { select: { title: true } }, // 관련 포스트 제목 포함
        parentComment: { select: { id: true, content: true } }, // 부모 댓글 정보 포함 (대댓글인 경우)
      },
    });

    // 생성된 댓글 응답
    res.status(201).send(newComment);
  })
);

// PATCH /comments/:id -> 특정 댓글을 수정
app.patch(
  "/comments/:id",
  asyncHandler(async (req, res) => {
    assert(req.body, UpdateComment); // 유효성 검사

    const { id } = req.params;

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
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await prisma.comment.delete({
      where: { id },
    });

    res.sendStatus(204); // No Content 응답
  })
);

app.listen(process.env.PORT || 3000, () => console.log("Server Started"));
