import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";

// 라우트 임포트
import authRoutes from "./routes/auth.js";
import postsRoutes from "./routes/posts.js";
import usersRoutes from "./routes/users.js";
import commentsRoutes from "./routes/comments.js";
import projectsRoutes from "./routes/projects.js";
import uploadRoutes from "./routes/upload.js";
import categoriesRoutes from "./routes/categories.js";
import tagsRoutes from "./routes/tags.js";

const app = express();

// 보안 미들웨어
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // IP당 최대 100 요청
  message: {
    success: false,
    error: "너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// 인증 관련 엄격한 Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 10, // IP당 최대 10 요청 (로그인 시도)
  message: {
    success: false,
    error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.",
  },
});

// CORS 설정
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 요청 로깅 미들웨어
app.use((req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("HTTP Request", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });
  });

  next();
});

// 라우트 설정
app.use("/auth", authLimiter, authRoutes);
app.use("/posts", postsRoutes);
app.use("/users", usersRoutes);
app.use("/comments", commentsRoutes);
app.use("/projects", projectsRoutes);
app.use("/upload", uploadRoutes);
app.use("/categories", categoriesRoutes);
app.use("/tags", tagsRoutes);

// Health Check
app.get("/health", (req: Request, res: Response): void => {
  res.json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 핸들러
app.use("*", (req: Request, res: Response): void => {
  logger.warn("404 Not Found", { url: req.originalUrl, method: req.method, ip: req.ip });
  res.status(404).json({
    success: false,
    error: "요청한 리소스를 찾을 수 없습니다.",
  });
});

// 전역 에러 핸들러
app.use((err: Error, req: Request, res: Response, next: NextFunction): void => {
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === "production" ? "서버 내부 오류가 발생했습니다." : err.message,
  });
});

// 서버 시작
app.listen(config.port, () => {
  logger.info(`Server started`, {
    port: config.port,
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
  console.log(`Server is running on http://localhost:${config.port}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

export default app;
