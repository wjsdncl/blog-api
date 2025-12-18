# Backend Development Rules - Express.js Blog API

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js 4.21
- **Language**: TypeScript 5.3
- **Database**: PostgreSQL with Prisma ORM 6.11
- **Authentication**: Supabase 2.47, JWT 9.0
- **Validation**: Zod 3.22, Superstruct 1.0
- **File Upload**: Multer, Sharp
- **Security**: Helmet 8.0, CORS 2.8, express-rate-limit 7.4
- **Logging**: Winston 3.17

## Express.js Best Practices

### Application Structure

1. **계층화 아키텍처**: Routes → Controllers → Services → Data Access
2. **미들웨어 체인**: 순서 중요 (helmet → cors → body-parser → auth → routes → error handler)
3. **모듈화**: 기능별로 파일 분리

```typescript
// Good: Express App Structure
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/errorHandler";
import routes from "./routes";

const app = express();

// Security middleware first
app.use(helmet());
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use("/api", routes);

// Error handler last
app.use(errorHandler);

export default app;
```

### Routing

1. **RESTful API**: 표준 HTTP 메서드 사용 (GET, POST, PUT, PATCH, DELETE)
2. **버전 관리**: API 버전을 URL에 포함 (`/api/v1/posts`)
3. **라우터 분리**: 리소스별로 라우터 파일 분리

```typescript
// Good: Router Structure
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { postSchema } from "../lib/schemas";

const router = Router();

// Public routes
router.get("/posts", getPosts);
router.get("/posts/:id", getPostById);

// Protected routes
router.post("/posts", authenticate, validateRequest(postSchema), createPost);
router.put("/posts/:id", authenticate, validateRequest(postSchema), updatePost);
router.delete("/posts/:id", authenticate, deletePost);

export default router;
```

### Middleware

1. **재사용성**: 공통 로직은 미들웨어로 추출
2. **순서**: 미들웨어 실행 순서 주의
3. **에러 처리**: next(error)로 에러 전달

```typescript
// Good: Authentication Middleware
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;

    next();
  } catch (error) {
    next(error);
  }
};
```

## TypeScript Best Practices

### 타입 정의

1. **명시적 타입**: 모든 함수 파라미터와 반환값에 타입 명시
2. **인터페이스**: 요청/응답 구조 인터페이스로 정의
3. **타입 가드**: 런타임 타입 체크

```typescript
// Good: Type Definitions
interface CreatePostRequest {
  title: string;
  content: string;
  categoryId: string;
  tags: string[];
}

interface PostResponse {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Good: Typed Handler
async function createPost(
  req: Request<{}, {}, CreatePostRequest>,
  res: Response<PostResponse>
): Promise<void> {
  const { title, content, categoryId, tags } = req.body;

  const post = await prisma.post.create({
    data: { title, content, categoryId, tags },
    include: { author: true },
  });

  res.status(201).json(post);
}
```

### Type Extensions

```typescript
// Good: Express Type Extensions
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}
```

## Prisma ORM Best Practices

### Schema Design Principles (Current Project Standards)

#### 1. Naming Conventions

**모델명 (Models)**: PascalCase

```prisma
model User { }
model Post { }
model Portfolio { }
```

**테이블명 (Tables)**: snake_case with @@map directive

```prisma
model User {
  @@map("users")
}
model PostLike {
  @@map("post_likes")
}
```

**필드명 (Fields)**: snake_case

```prisma
model Post {
  author_id     String
  category_id   String?
  published_at  DateTime?
  created_at    DateTime
}
```

**Relation 필드명**: camelCase

```prisma
model Post {
  author    User       @relation(fields: [author_id], references: [id])
  category  Category?  @relation(fields: [category_id], references: [id])
  comments  Comment[]
  postLikes PostLike[]
}
```

**Enum**: PascalCase with descriptive names

```prisma
enum Role {
  USER
  OWNER
  @@schema("public")
}
```

#### 2. ID Strategy

**모든 모델은 UUID 사용** (auto-increment 대신)

```prisma
model Post {
  id String @id @default(uuid())
}
```

**장점**:

- 분산 시스템에서 충돌 없음
- 보안상 ID 예측 불가
- 마이그레이션 시 충돌 방지

#### 3. Soft Delete Pattern

**모든 리소스에 소프트 삭제 적용**

```prisma
model Post {
  is_deleted Boolean   @default(false)
  deleted_at DateTime?

  @@index([is_deleted])
  @@index([is_deleted, published])
}
```

**쿼리 시 항상 is_deleted 확인**:

```typescript
const posts = await prisma.post.findMany({
  where: { is_deleted: false },
});
```

#### 4. Timestamp Pattern

**모든 모델에 생성일/수정일 추가**

```prisma
model Post {
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  published_at DateTime? // 최초 공개일 (별도 관리)
  deleted_at DateTime?   // 삭제일 (soft delete)
}
```

#### 5. Caching Fields

**자주 계산되는 값은 캐싱 필드로 저장**

```prisma
model Post {
  view_count    Int @default(0)
  like_count    Int @default(0)
  comment_count Int @default(0)
}

model Category {
  post_count Int @default(0)
}

model TechStack {
  usage_count Int @default(0)
}
```

**업데이트 시 트랜잭션 사용**:

```typescript
await prisma.$transaction([
  prisma.postLike.create({ data: { user_id, post_id } }),
  prisma.post.update({
    where: { id: post_id },
    data: { like_count: { increment: 1 } },
  }),
]);
```

#### 6. Multi-Schema Strategy

**인증 정보는 별도 스키마로 분리**

```prisma
datasource db {
  schemas = ["public", "Auth"]
}

model Auth {
  @@schema("Auth")
}

model User {
  @@schema("public")
}
```

**장점**:

- 보안 강화 (DB 권한 분리)
- 스키마 마이그레이션 독립적 관리
- 백업/복원 전략 분리

#### 7. Relationship Patterns

**1:1 관계** (User ↔ Auth)

```prisma
model User {
  id   String @id @default(uuid())
  auth Auth?
}

model Auth {
  id      String @id @default(uuid())
  user_id String @unique
  user    User   @relation(fields: [user_id], references: [id], onDelete: Cascade)
}
```

**1:N 관계** (User → Post)

```prisma
model User {
  posts Post[]
}

model Post {
  author_id String
  author    User   @relation(fields: [author_id], references: [id], onDelete: Cascade)

  @@index([author_id])
}
```

**N:M 관계** (Post ↔ Tag)

```prisma
model Post {
  tags Tag[]
}

model Tag {
  posts Post[]
}
```

**Self-Referencing** (Comment 답글 구조)

```prisma
model Comment {
  parent_id String?
  parent    Comment?  @relation("CommentReplies", fields: [parent_id], references: [id], onDelete: Cascade)
  replies   Comment[] @relation("CommentReplies")

  @@index([parent_id])
}
```

#### 8. Indexing Strategy

**단일 인덱스**: FK, unique 필드, 자주 조회되는 필드

```prisma
model Post {
  @@index([author_id])
  @@index([category_id])
  @@index([slug])
  @@index([is_deleted])
}
```

**복합 인덱스**: 자주 함께 사용되는 조건

```prisma
model Post {
  @@index([published, created_at])        // 공개글 최신순
  @@index([author_id, published])         // 특정 작성자의 공개글
  @@index([category_id, published])       // 카테고리별 공개글
  @@index([is_deleted, published])        // 삭제되지 않은 공개글
}

model Comment {
  @@index([post_id, is_deleted, created_at]) // 게시글의 최신 댓글
}
```

**인덱스 순서**: 선택도가 높은 필드를 앞에 배치

#### 9. Data Integrity (onDelete Actions)

**Cascade**: 부모 삭제 시 자식도 삭제

```prisma
model Post {
  author User @relation(fields: [author_id], references: [id], onDelete: Cascade)
}
```

**SetNull**: 부모 삭제 시 FK를 NULL로 설정

```prisma
model Post {
  category Category? @relation(fields: [category_id], references: [id], onDelete: SetNull)
}
```

**Restrict**: 자식이 있으면 부모 삭제 불가

```prisma
model PortfolioLink {
  type PortfolioLinkType @relation(fields: [type_id], references: [id], onDelete: Restrict)
}
```

#### 10. Optional vs Required Fields

**필수 필드**: title, content, author_id 등 핵심 데이터

```prisma
model Post {
  title      String
  content    String  @db.Text
  author_id  String
}
```

**선택 필드**: excerpt, cover_image, description 등 부가 정보

```prisma
model Post {
  excerpt     String?  @db.Text
  cover_image String?
  category_id String?
}
```

#### 11. String Field Types

**단순 문자열**: String (기본, VARCHAR 255)

```prisma
title  String
slug   String
url    String
```

**긴 텍스트**: @db.Text (TEXT 타입)

```prisma
content     String @db.Text
description String? @db.Text
```

**토큰/키**: @db.Text (긴 문자열 저장)

```prisma
access_token  String? @db.Text
refresh_token String? @db.Text
```

#### 12. Boolean Defaults

**명시적 기본값 설정**

```prisma
published  Boolean @default(false)
is_deleted Boolean @default(false)
```

#### 13. Documentation with JSDoc

**모델에 JSDoc 주석 추가**

```prisma
/// 사용자 기본 정보
model User {
  id String @id @default(uuid()) // 사용자 고유 ID
}

/// 블로그 게시글
model Post {
  title String // 제목
  slug  String @unique // URL 경로
}
```

### Legacy Schema Example (DO NOT USE)

```prisma
// Bad: Old patterns (before migration)
model Post {
  id          String    @id @default(uuid())
  title       String
  slug        String    @unique
  content     String
  published   Boolean   @default(false)
  authorId    String      // ❌ camelCase in field name
  categoryId  String
  createdAt   DateTime  @default(now())  // ❌ camelCase in field name
  updatedAt   DateTime  @updatedAt       // ❌ camelCase in field name

  author      User      @relation(fields: [authorId], references: [id])
  category    Category  @relation(fields: [categoryId], references: [id])
  tags        Tag[]     @relation("PostTags")
  comments    Comment[]

  @@index([authorId])
  @@index([categoryId])
  @@index([slug])
  @@index([createdAt])
}
```

### Current Project Schema Standards

```prisma
// Good: Current standards (post-migration)
/// 블로그 게시글
model Post {
  id            String    @id @default(uuid())           // UUID 기반 ID
  title         String                                   // 제목
  slug          String    @unique                        // URL 경로
  content       String    @db.Text                       // 본문 (긴 텍스트)
  excerpt       String?   @db.Text                       // 요약 (선택)
  cover_image   String?                                  // 커버 이미지 URL
  published     Boolean   @default(false)                // 공개 여부
  is_deleted    Boolean   @default(false)                // Soft delete
  view_count    Int       @default(0)                    // 조회수 캐싱
  like_count    Int       @default(0)                    // 좋아요 수 캐싱
  comment_count Int       @default(0)                    // 댓글 수 캐싱
  author_id     String                                   // 작성자 ID (FK)
  category_id   String?                                  // 카테고리 ID (FK, 선택)
  published_at  DateTime?                                // 최초 공개일
  deleted_at    DateTime?                                // 삭제일
  created_at    DateTime  @default(now())                // 생성일
  updated_at    DateTime  @updatedAt                     // 수정일

  // Relations (camelCase)
  author    User       @relation(fields: [author_id], references: [id], onDelete: Cascade)
  category  Category?  @relation(fields: [category_id], references: [id], onDelete: SetNull)
  tags      Tag[]
  comments  Comment[]
  postLikes PostLike[]

  // Indexes
  @@index([author_id])
  @@index([category_id])
  @@index([slug])
  @@index([is_deleted])
  @@index([published, created_at])               // 복합: 공개글 최신순
  @@index([author_id, published])                // 복합: 작성자별 공개글
  @@index([category_id, published])              // 복합: 카테고리별 공개글
  @@index([is_deleted, published])               // 복합: 삭제되지 않은 공개글

  @@map("posts")      // 테이블명: snake_case
  @@schema("public")  // 스키마: public
}
```

### Query Patterns

1. **Include/Select**: 필요한 데이터만 가져오기
2. **트랜잭션**: 여러 작업은 transaction으로 묶기
3. **에러 처리**: Prisma 에러 적절히 처리

```typescript
// Good: Prisma Query
async function getPostWithDetails(postId: string) {
  return await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      content: true,
      author: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
      category: true,
      tags: true,
      _count: {
        select: {
          comments: true,
          likes: true,
        },
      },
    },
  });
}

// Good: Transaction
async function createPostWithTags(data: CreatePostData) {
  return await prisma.$transaction(async (tx) => {
    const post = await tx.post.create({
      data: {
        title: data.title,
        content: data.content,
        authorId: data.authorId,
      },
    });

    await tx.tag.createMany({
      data: data.tags.map((tag) => ({
        name: tag,
        postId: post.id,
      })),
    });

    return post;
  });
}
```

### Performance Optimization

```typescript
// Good: Batch Queries
const [posts, categories, tags] = await Promise.all([
  prisma.post.findMany(),
  prisma.category.findMany(),
  prisma.tag.findMany(),
]);

// Good: Pagination
async function getPosts(page: number, limit: number) {
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.post.count(),
  ]);

  return {
    posts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

## Validation Best Practices

### Zod Schema

1. **스키마 정의**: 모든 입력 데이터 검증
2. **재사용**: 공통 스키마는 lib/schemas.ts에 정의
3. **에러 메시지**: 사용자 친화적인 에러 메시지

```typescript
// Good: Zod Schema
import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  content: z.string().min(10, "Content must be at least 10 characters"),
  categoryId: z.string().uuid("Invalid category ID"),
  tags: z.array(z.string()).min(1, "At least one tag is required").max(10),
  published: z.boolean().optional().default(false),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

// Good: Validation Middleware
export const validateRequest = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          details: error.errors,
        });
      }
      next(error);
    }
  };
};
```

## Authentication & Authorization

### JWT Pattern

```typescript
// Good: JWT Utilities
import jwt from "jsonwebtoken";

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
}
```

### Role-Based Access Control

```typescript
// Good: Authorization Middleware
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
};

// Usage
router.delete("/posts/:id", authenticate, authorize("admin"), deletePost);
```

## Error Handling

### Error Classes

```typescript
// Good: Custom Error Classes
export class AppError extends Error {
  constructor(public statusCode: number, public message: string, public isOperational = true) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, message);
  }
}
```

### Error Handler

```typescript
// Good: Global Error Handler
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log error
  logger.error("Error:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  // Prisma errors
  if (err.name === "PrismaClientKnownRequestError") {
    return res.status(400).json({
      error: "Database error",
      message: "Invalid request",
    });
  }

  // Custom errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  // Default error
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
};
```

## Security Best Practices

### Input Sanitization

```typescript
// Good: Sanitize Input
import { escape } from "validator";

function sanitizeInput(input: string): string {
  return escape(input.trim());
}
```

### Rate Limiting

```typescript
// Good: Rate Limiter
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);

// Stricter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
});

app.use("/api/auth/", authLimiter);
```

### SQL Injection Prevention

```typescript
// Good: Use Prisma (prevents SQL injection)
const post = await prisma.post.findUnique({
  where: { id: postId },
});

// Bad: Raw SQL (vulnerable)
// const post = await prisma.$queryRaw`SELECT * FROM Post WHERE id = ${postId}`;
```

## File Upload

### Multer Configuration

```typescript
// Good: File Upload Configuration
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only images are allowed"));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});
```

### Image Processing

```typescript
// Good: Sharp Image Processing
import sharp from "sharp";

async function processImage(filePath: string) {
  const outputPath = filePath.replace(/\.[^.]+$/, "-processed.jpg");

  await sharp(filePath)
    .resize(1200, 800, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(outputPath);

  return outputPath;
}
```

## Logging

### Winston Configuration

```typescript
// Good: Logger Setup
import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })
  );
}

// Usage
logger.info("Server started", { port: 3000 });
logger.error("Error occurred", { error: err.message, stack: err.stack });
```

## Testing

### Unit Tests

```typescript
// Good: Test Example
import { describe, it, expect } from "vitest";
import { generateToken, verifyToken } from "./auth";

describe("Auth Utils", () => {
  it("should generate and verify token", () => {
    const payload = { userId: "123", email: "test@test.com", role: "user" };
    const token = generateToken(payload);
    const decoded = verifyToken(token);

    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });
});
```

## API Documentation

### JSDoc Comments

```typescript
/**
 * Get all posts with pagination
 * @param page - Page number (1-indexed)
 * @param limit - Number of items per page
 * @returns Paginated list of posts
 */
async function getPosts(page: number, limit: number): Promise<PaginatedResponse<Post>> {
  // Implementation
}
```

## Environment Variables

### Configuration

```typescript
// Good: Environment Configuration
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.string().transform(Number),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string(),
});

export const config = envSchema.parse(process.env);
```

## Performance

### Caching

```typescript
// Good: Simple In-Memory Cache
const cache = new Map<string, { data: any; expiry: number }>();

function getCached<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item) return null;

  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }

  return item.data;
}

function setCache(key: string, data: any, ttl: number = 300000) {
  cache.set(key, {
    data,
    expiry: Date.now() + ttl,
  });
}
```

## AI Assistant Specific

- 모든 엔드포인트에 적절한 인증/인가 처리
- Prisma 쿼리 최적화 (N+1 문제 방지)
- 에러는 일관된 형식으로 반환
- 입력 검증은 Zod 스키마 사용
- 민감한 정보는 로깅하지 않음
- 트랜잭션이 필요한 경우 명확히 표시
