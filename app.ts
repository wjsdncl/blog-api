/**
 * Fastify 서버 엔트리포인트
 *
 * 플러그인 등록 순서: Swagger → Helmet → CORS → Cookie → Multipart → RateLimit
 * 라우트 인증 레벨: optionalAuthenticate(공개) / requiredAuthenticate(로그인) / requireOwner(관리자)
 */
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";

import { config } from "@/config/index.js";
import { logger } from "@/utils/logger.js";
import { errorHandler } from "@/middleware/errorHandler.js";
import { setupSwagger } from "@/config/swagger.js";

import authRoutes from "@/routes/auth.js";
import usersRoutes from "@/routes/users.js";
import postsRoutes from "@/routes/posts.js";
import categoriesRoutes from "@/routes/categories.js";
import tagsRoutes from "@/routes/tags.js";
import commentsRoutes from "@/routes/comments.js";
import portfoliosRoutes from "@/routes/portfolios.js";
import techStacksRoutes from "@/routes/tech-stacks.js";
import uploadRoutes from "@/routes/upload.js";

const app: FastifyInstance = Fastify({
  logger: false, // Winston을 사용하므로 Fastify 로거는 비활성화
  trustProxy: true, // Render 등 리버스 프록시 환경에서 실제 클라이언트 IP 사용
  bodyLimit: 10485760, // 10MB
  requestIdLogLabel: "requestId",
});

async function buildApp(): Promise<FastifyInstance> {
  await setupSwagger(app);

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

  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });

  await app.register(cookie);
  await app.register(multipart);

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "15 minutes",
    errorResponseBuilder: (_req, _context) => {
      return {
        success: false,
        error: "너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.",
      };
    },
  });

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

  app.setErrorHandler(errorHandler);

  app.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    logger.warn("404 Not Found", { url: request.url, method: request.method, ip: request.ip });
    return reply.status(404).send({
      success: false,
      error: "요청한 리소스를 찾을 수 없습니다.",
    });
  });

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(usersRoutes, { prefix: "/users" });
  await app.register(postsRoutes, { prefix: "/posts" });
  await app.register(categoriesRoutes, { prefix: "/categories" });
  await app.register(tagsRoutes, { prefix: "/tags" });
  await app.register(commentsRoutes, { prefix: "/comments" });
  await app.register(portfoliosRoutes, { prefix: "/portfolios" });
  await app.register(techStacksRoutes, { prefix: "/tech-stacks" });
  await app.register(uploadRoutes, { prefix: "/upload" });

  app.get("/health", async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      message: "Server is healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  return app;
}

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

start();

export default app;
