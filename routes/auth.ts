/**
 * 인증 라우트 — OAuth 2.0 (BFF Pattern)
 *
 * 흐름: /oauth → 제공자 리다이렉트 → /oauth/callback → JWT 쿠키 발급 → 프론트 리다이렉트
 * CSRF 방지: oauth_state 쿠키에 랜덤 state 저장 후 콜백에서 검증
 * 토큰은 HttpOnly 쿠키로만 관리, 브라우저 JS에 노출되지 않음
 */
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@/lib/prismaClient.js";
import { generateTokens, verifyRefreshToken, verifyAccessToken } from "@/utils/auth.js";
import { config } from "@/config/index.js";
import { logger } from "@/utils/logger.js";
import { AppError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/errors.js";

// Services
import { getOAuthService, getSupportedProviders } from "@/services/oauth/index.js";
import {
  findOrCreateUser,
  setAuthCookies,
  clearAuthCookies,
  getSessionInfo,
} from "@/services/auth.service.js";
import { zodToJsonSchema } from "@/utils/zodToJsonSchema.js";


interface OAuthState {
  state: string;
  provider: string;
}

const oauthQuerySchema = z.object({
  type: z.enum(["github", "google"]),
});

const oauthCallbackSchema = z.object({
  code: z.string(),
  state: z.string(),
});


function setOAuthStateCookie(reply: FastifyReply, oauthState: OAuthState): void {
  reply.setCookie("oauth_state", JSON.stringify(oauthState), {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10분
  });
}

function getOAuthStateCookie(request: FastifyRequest): OAuthState | null {
  try {
    const cookie = (request.cookies as Record<string, string>).oauth_state;
    return cookie ? JSON.parse(cookie) : null;
  } catch {
    return null;
  }
}

function clearOAuthStateCookie(reply: FastifyReply): void {
  reply.clearCookie("oauth_state", { path: "/" });
}


const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /auth/oauth?type=github|google
   * OAuth 로그인 시작 - 제공자 인증 페이지로 리다이렉트
   */
  fastify.get("/oauth", {
    schema: {
      tags: ["Auth"],
      summary: "OAuth 로그인 시작",
      description: "OAuth 제공자(GitHub, Google)의 인증 페이지로 리다이렉트합니다.",
      querystring: zodToJsonSchema(oauthQuerySchema),
      response: {
        302: { description: "OAuth 제공자로 리다이렉트", type: "null" },
        400: {
          description: "잘못된 요청",
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string" },
          },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = oauthQuerySchema.safeParse(request.query);

      if (!parseResult.success) {
        throw new BadRequestError(
          `지원하지 않는 OAuth 제공자입니다. 지원: ${getSupportedProviders().join(", ")}`
        );
      }

      const { type } = parseResult.data;
      const service = getOAuthService(type);

      if (!service?.isConfigured()) {
        throw new BadRequestError(`${type} OAuth가 설정되지 않았습니다.`);
      }

      const state = crypto.randomUUID();
      setOAuthStateCookie(reply, { state, provider: type });

      return reply.redirect(service.getAuthUrl(state));
    },
  });

  /**
   * GET /auth/oauth/callback?code=...&state=...
   * OAuth 콜백 처리 (모든 제공자 공통)
   */
  fastify.get("/oauth/callback", {
    schema: {
      tags: ["Auth"],
      summary: "OAuth 콜백",
      description: "OAuth 제공자로부터의 콜백을 처리합니다. 인증 성공 시 프론트엔드로 리다이렉트됩니다.",
      querystring: zodToJsonSchema(oauthCallbackSchema),
      response: {
        302: { description: "프론트엔드로 리다이렉트", type: "null" },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = oauthCallbackSchema.safeParse(request.query);

      if (!parseResult.success) {
        logger.warn("OAuth callback missing parameters", { query: request.query });
        return reply.redirect(`${config.frontendUrl}/auth/error?message=invalid_request`);
      }

      const { code, state } = parseResult.data;
      const saved = getOAuthStateCookie(request);

      // CSRF 검증
      if (!saved || saved.state !== state) {
        logger.warn("OAuth callback state mismatch", {
          savedState: saved?.state,
          receivedState: state,
        });
        return reply.redirect(`${config.frontendUrl}/auth/error?message=invalid_state`);
      }

      clearOAuthStateCookie(reply);

      const service = getOAuthService(saved.provider);

      if (!service) {
        logger.error("OAuth service not found", { provider: saved.provider });
        return reply.redirect(`${config.frontendUrl}/auth/error?message=invalid_provider`);
      }

      try {
        const accessToken = await service.exchangeCode(code);
        const userInfo = await service.fetchUserInfo(accessToken);
        const user = await findOrCreateUser(userInfo);
        const tokens = generateTokens(user.id, user.email);
        setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);

        return reply.redirect(`${config.frontendUrl}/auth/callback?provider=${saved.provider}`);
      } catch (error) {
        if (error instanceof ForbiddenError) {
          logger.warn("Inactive user login blocked", { provider: saved.provider });
          return reply.redirect(`${config.frontendUrl}/auth/error?message=account_inactive`);
        }

        logger.error("OAuth error", {
          provider: saved.provider,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return reply.redirect(`${config.frontendUrl}/auth/error?message=oauth_failed`);
      }
    },
  });

  /**
   * POST /auth/refresh
   * 토큰 갱신
   */
  fastify.post("/refresh", {
    schema: {
      tags: ["Auth"],
      summary: "토큰 갱신",
      description: "리프레시 토큰을 사용하여 새로운 액세스 토큰을 발급받습니다.",
      security: [{ cookieAuth: [] }],
      response: {
        200: {
          description: "갱신 성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
          },
        },
        401: {
          description: "인증 실패",
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string" },
          },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const refreshToken = (request.cookies as Record<string, string>).refresh_token;

      if (!refreshToken) {
        throw new UnauthorizedError("리프레시 토큰이 없습니다.");
      }

      try {
        const decoded = verifyRefreshToken(refreshToken);

        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true, is_active: true },
        });

        if (!user) {
          clearAuthCookies(reply);
          throw new UnauthorizedError("사용자를 찾을 수 없습니다.");
        }

        if (!user.is_active) {
          clearAuthCookies(reply);
          throw new UnauthorizedError("비활성화된 계정입니다.");
        }

        const tokens = generateTokens(user.id, user.email);
        setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);

        return reply.send({
          success: true,
          message: "토큰이 갱신되었습니다.",
        });
      } catch (error) {
        if (error instanceof AppError) throw error;
        clearAuthCookies(reply);
        throw new UnauthorizedError("유효하지 않은 리프레시 토큰입니다.");
      }
    },
  });

  /**
   * POST /auth/logout
   * 로그아웃
   */
  fastify.post("/logout", {
    schema: {
      tags: ["Auth"],
      summary: "로그아웃",
      description: "인증 쿠키를 삭제하여 로그아웃합니다.",
      response: {
        200: {
          description: "로그아웃 성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
          },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      clearAuthCookies(reply);

      logger.info("User logged out", { ip: request.ip });

      return reply.send({
        success: true,
        message: "로그아웃 되었습니다.",
      });
    },
  });

  /**
   * GET /auth/session
   * 현재 인증 상태 확인
   */
  fastify.get("/session", {
    schema: {
      tags: ["Auth"],
      summary: "세션 확인",
      description: "현재 인증 상태와 사용자 정보를 조회합니다.",
      response: {
        200: {
          description: "성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                authenticated: { type: "boolean" },
                userId: { type: "string", format: "uuid" },
                role: { type: "string", enum: ["OWNER", "USER"] },
              },
            },
          },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const accessToken = (request.cookies as Record<string, string>).access_token;

      if (!accessToken) {
        return reply.send({
          success: true,
          data: { authenticated: false },
        });
      }

      try {
        const decoded = verifyAccessToken(accessToken);
        const session = await getSessionInfo(decoded.userId);

        if (!session) {
          return reply.send({
            success: true,
            data: { authenticated: false },
          });
        }

        return reply.send({
          success: true,
          data: {
            authenticated: true,
            userId: session.id,
            role: session.role,
          },
        });
      } catch (error) {
        if (error instanceof Error && ["TokenExpiredError", "JsonWebTokenError", "NotBeforeError"].includes(error.name)) {
          return reply.send({
            success: true,
            data: { authenticated: false },
          });
        }
        throw error;
      }
    },
  });
  /**
   * POST /auth/dev-login
   * 개발 환경 전용 즉시 로그인 (production에서는 등록되지 않음)
   */
  if (config.nodeEnv !== "production") {
    const devLoginSchema = z.object({
      role: z.enum(["OWNER", "USER"]).default("OWNER"),
    });

    fastify.post("/dev-login", {
      schema: {
        tags: ["Auth"],
        summary: "[DEV] 개발용 즉시 로그인",
        description: "개발 환경 전용. 지정한 role의 첫 번째 활성 유저로 즉시 로그인합니다.",
        body: zodToJsonSchema(devLoginSchema),
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  userId: { type: "string" },
                  role: { type: "string" },
                  username: { type: "string" },
                },
              },
            },
          },
        },
      },
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        const { role } = devLoginSchema.parse(request.body);

        const user = await prisma.user.findFirst({
          where: { role, is_active: true },
          select: { id: true, email: true, role: true, username: true },
        });

        if (!user) {
          throw new NotFoundError(`활성 ${role} 유저`);
        }

        const tokens = generateTokens(user.id, user.email);
        setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);

        return reply.send({
          success: true,
          data: { userId: user.id, role: user.role, username: user.username },
        });
      },
    });
  }
};

export default authRoutes;
