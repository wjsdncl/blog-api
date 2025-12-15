import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";

import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Routes
import authRoutes from "./routes/auth.js";
import postsRoutes from "./routes/posts.js";
import usersRoutes from "./routes/users.js";
import commentsRoutes from "./routes/comments.js";
import projectsRoutes from "./routes/projects.js";
import uploadRoutes from "./routes/upload.js";
import categoriesRoutes from "./routes/categories.js";
import tagsRoutes from "./routes/tags.js";

const app: FastifyInstance = Fastify({
  logger: false, // Winston을 사용하므로 Fastify 로거는 비활성화
  bodyLimit: 10485760, // 10MB
  requestIdLogLabel: "requestId",
});

// 플러그인 등록
async function buildApp(): Promise<FastifyInstance> {
  // Helmet (보안)
  await app.register(helmet, {
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  });

  // CORS
  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });

  // Cookie
  await app.register(cookie);

  // Multipart (파일 업로드)
  await app.register(multipart);

  // Rate Limiting (전역)
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "15 minutes",
    errorResponseBuilder: (req, context) => {
      return {
        success: false,
        error: "너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.",
      };
    },
  });

  // 요청 로깅 훅
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    request.startTime = Date.now();
  });

  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const duration = Date.now() - (request.startTime || 0);
    logger.info("HTTP Request", {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${duration}ms`,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
  });

  // 라우트 등록
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(postsRoutes, { prefix: "/posts" });
  await app.register(usersRoutes, { prefix: "/users" });
  await app.register(commentsRoutes, { prefix: "/comments" });
  await app.register(projectsRoutes, { prefix: "/projects" });
  await app.register(uploadRoutes, { prefix: "/upload" });
  await app.register(categoriesRoutes, { prefix: "/categories" });
  await app.register(tagsRoutes, { prefix: "/tags" });

  // Error Handler
  app.setErrorHandler(errorHandler);

  // Health Check
  app.get("/health", async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      message: "Server is healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // 404 핸들러
  app.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    logger.warn("404 Not Found", { url: request.url, method: request.method, ip: request.ip });
    return reply.status(404).send({
      success: false,
      error: "요청한 리소스를 찾을 수 없습니다.",
    });
  });

  // 전역 에러 핸들러
  app.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
    logger.error("Unhandled error", {
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      ip: request.ip,
    });

    return reply.status(500).send({
      success: false,
      error: process.env.NODE_ENV === "production" ? "서버 내부 오류가 발생했습니다." : error.message,
    });
  });

  return app;
}

// 서버 시작
async function start(): Promise<void> {
  try {
    await buildApp();
    await app.listen({ port: config.port, host: "0.0.0.0" });

    logger.info(`Server started`, {
      port: config.port,
      environment: config.nodeEnv,
      timestamp: new Date().toISOString(),
    });
    console.log(`Server is running on http://localhost:${config.port}`);
  } catch (err) {
    logger.error("Failed to start server", { error: err });
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  await app.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  await app.close();
  process.exit(0);
});

// 서버 시작 (최상위 레벨 await)
start();

export default app;
