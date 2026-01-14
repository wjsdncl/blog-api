/**
 * Swagger Configuration
 * API 문서 설정 (프로덕션 환경에서 Basic Auth로 보호)
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyBasicAuth from "@fastify/basic-auth";
import { config } from "@/config/index.js";

// 숨길 관리자 전용 태그 (SWAGGER_HIDE_ADMIN=true 시 적용)
const ADMIN_TAGS = ["Users"];

// Basic Auth 인증 함수
async function validateCredentials(
  username: string,
  password: string,
  _req: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  if (username !== config.swagger.username || password !== config.swagger.password) {
    throw new Error("Unauthorized");
  }
}

export async function setupSwagger(app: FastifyInstance): Promise<void> {
  // Swagger 비활성화 시 등록하지 않음
  if (!config.swagger.enabled) {
    return;
  }

  const isProduction = config.nodeEnv === "production";

  // 프로덕션 환경에서 Basic Auth 설정
  if (isProduction) {
    await app.register(fastifyBasicAuth, {
      validate: validateCredentials,
      authenticate: {
        realm: "API Documentation",
      },
    });
  }

  // 서버 URL 설정
  const servers = isProduction
    ? [{ url: config.frontendUrl.replace(/:\d+$/, "").replace("3000", "8000"), description: "Production server" }]
    : [{ url: `http://localhost:${config.port}`, description: "Development server" }];

  // 숨길 태그 결정
  const hiddenTags = config.swagger.hideAdminEndpoints ? ADMIN_TAGS : [];

  // 표시할 태그만 필터링
  const visibleTags = [
    { name: "Auth", description: "인증 관련 API" },
    { name: "Users", description: "사용자 관리 API" },
    { name: "Posts", description: "게시글 관리 API" },
    { name: "Categories", description: "카테고리 관리 API" },
    { name: "Tags", description: "태그 관리 API" },
    { name: "Comments", description: "댓글 관리 API" },
    { name: "Portfolios", description: "포트폴리오 관리 API" },
    { name: "TechStacks", description: "기술 스택 관리 API" },
  ].filter((tag) => !hiddenTags.includes(tag.name));

  await app.register(fastifySwagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "Dev Blog API",
        description: `개발 블로그 API 문서${isProduction ? " (Production)" : " (Development)"}`,
        version: "1.0.0",
        contact: {
          name: "API Support",
        },
      },
      servers,
      tags: visibleTags,
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "JWT 액세스 토큰",
          },
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "refreshToken",
            description: "리프레시 토큰 쿠키",
          },
        },
        schemas: {
          // 공통 응답 스키마
          SuccessResponse: {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "object" },
              message: { type: "string" },
            },
          },
          ErrorResponse: {
            type: "object",
            properties: {
              success: { type: "boolean", example: false },
              error: { type: "string" },
            },
          },
          PaginationMeta: {
            type: "object",
            properties: {
              page: { type: "integer", example: 1 },
              limit: { type: "integer", example: 10 },
              total: { type: "integer", example: 100 },
              totalPages: { type: "integer", example: 10 },
              hasNext: { type: "boolean", example: true },
              hasPrev: { type: "boolean", example: false },
            },
          },
          // 엔티티 스키마
          User: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              username: { type: "string", example: "johndoe" },
              email: { type: "string", format: "email" },
              role: { type: "string", enum: ["OWNER", "MEMBER"] },
              is_active: { type: "boolean" },
              created_at: { type: "string", format: "date-time" },
            },
          },
          Post: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              title: { type: "string", example: "첫 번째 게시글" },
              slug: { type: "string", example: "first-post" },
              content: { type: "string" },
              excerpt: { type: "string" },
              cover_image: { type: "string", format: "uri" },
              status: { type: "string", enum: ["DRAFT", "PUBLISHED", "SCHEDULED"] },
              view_count: { type: "integer" },
              like_count: { type: "integer" },
              comment_count: { type: "integer" },
              published_at: { type: "string", format: "date-time", nullable: true },
              created_at: { type: "string", format: "date-time" },
              updated_at: { type: "string", format: "date-time" },
              category: { $ref: "#/components/schemas/Category" },
              tags: { type: "array", items: { $ref: "#/components/schemas/Tag" } },
            },
          },
          Category: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string", example: "개발" },
              slug: { type: "string", example: "개발" },
              order: { type: "integer" },
              post_count: { type: "integer" },
              created_at: { type: "string", format: "date-time" },
            },
          },
          Tag: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string", example: "TypeScript" },
              slug: { type: "string", example: "typescript" },
              created_at: { type: "string", format: "date-time" },
            },
          },
          Comment: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              content: { type: "string" },
              post_id: { type: "string", format: "uuid" },
              parent_id: { type: "string", format: "uuid", nullable: true },
              like_count: { type: "integer" },
              is_liked: { type: "boolean" },
              created_at: { type: "string", format: "date-time" },
              updated_at: { type: "string", format: "date-time" },
              author: { $ref: "#/components/schemas/CommentAuthor" },
              replies: { type: "array", items: { $ref: "#/components/schemas/Comment" } },
            },
          },
          CommentAuthor: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              username: { type: "string" },
              role: { type: "string", enum: ["OWNER", "MEMBER"] },
            },
          },
          Portfolio: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              title: { type: "string" },
              slug: { type: "string" },
              content: { type: "string" },
              excerpt: { type: "string" },
              cover_image: { type: "string", format: "uri" },
              start_date: { type: "string", format: "date" },
              end_date: { type: "string", format: "date", nullable: true },
              status: { type: "string", enum: ["DRAFT", "PUBLISHED", "SCHEDULED"] },
              view_count: { type: "integer" },
              order: { type: "integer" },
              published_at: { type: "string", format: "date-time", nullable: true },
              created_at: { type: "string", format: "date-time" },
              updated_at: { type: "string", format: "date-time" },
              category: { $ref: "#/components/schemas/Category" },
              tags: { type: "array", items: { $ref: "#/components/schemas/Tag" } },
              techStacks: { type: "array", items: { $ref: "#/components/schemas/TechStack" } },
              links: { type: "array", items: { $ref: "#/components/schemas/PortfolioLink" } },
            },
          },
          PortfolioLink: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              type: { type: "string", example: "github" },
              url: { type: "string", format: "uri" },
              label: { type: "string" },
              order: { type: "integer" },
            },
          },
          TechStack: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string", example: "React" },
              category: { type: "string", example: "Frontend" },
              portfolio_count: { type: "integer" },
              created_at: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    // 숨길 태그의 라우트는 문서에서 제외
    transform: config.swagger.hideAdminEndpoints
      ? ({ schema, url, route }) => {
          const routeTags = schema?.tags as string[] | undefined;
          if (routeTags?.some((tag) => hiddenTags.includes(tag))) {
            return { schema: { hide: true }, url, route };
          }
          return { schema, url, route };
        }
      : undefined,
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      persistAuthorization: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    // 프로덕션에서 Basic Auth 적용
    uiHooks: isProduction
      ? {
          onRequest: app.basicAuth,
        }
      : undefined,
  });
}
