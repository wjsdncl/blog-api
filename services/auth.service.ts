/**
 * Auth Service
 * 사용자 인증 관련 비즈니스 로직
 */
import { FastifyReply } from "fastify";
import { prisma } from "@/lib/prismaClient.js";
import { config } from "@/config/index.js";
import { logger } from "@/utils/logger.js";
import { ForbiddenError } from "@/lib/errors.js";
import type { OAuthUserInfo } from "@/services/oauth/types.js";

/**
 * 비활성화된 사용자 에러
 */
export class InactiveUserError extends ForbiddenError {
  constructor() {
    super("비활성화된 계정입니다. 관리자에게 문의해주세요.");
  }
}

/**
 * 사용자 조회 또는 생성
 */
export async function findOrCreateUser(userInfo: OAuthUserInfo) {
  const { provider, providerId, email, username } = userInfo;

  // 1. 이메일로 기존 사용자 조회
  let user = await prisma.user.findUnique({
    where: { email },
    include: { auth: true },
  });

  if (user) {
    // 비활성화된 사용자 체크
    if (!user.is_active) {
      logger.warn("Inactive user attempted login", {
        userId: user.id,
        email,
        provider,
      });
      throw new InactiveUserError();
    }

    // 기존 사용자 - Auth 정보 확인/생성
    const existingAuth = user.auth;

    if (!existingAuth) {
      // Auth 정보가 없으면 생성
      await prisma.auth.create({
        data: {
          user_id: user.id,
          provider,
          provider_id: providerId,
        },
      });
    } else if (existingAuth.provider !== provider) {
      // 다른 OAuth 제공자로 가입된 경우 - 기존 제공자 정보 업데이트
      logger.warn("User tried different OAuth provider", {
        userId: user.id,
        existingProvider: existingAuth.provider,
        attemptedProvider: provider,
      });

      await prisma.auth.update({
        where: { id: existingAuth.id },
        data: {
          provider,
          provider_id: providerId,
        },
      });
    }

    logger.info("Existing user logged in via OAuth", {
      userId: user.id,
      email,
      provider,
    });

    return user;
  }

  // 2. 새 사용자 생성
  user = await prisma.user.create({
    data: {
      email,
      username,
      role: "USER",
      auth: {
        create: {
          provider,
          provider_id: providerId,
        },
      },
    },
    include: { auth: true },
  });

  logger.info("New user created via OAuth", {
    userId: user.id,
    email,
    provider,
  });

  return user;
}

/**
 * 인증 쿠키 설정
 */
export function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string): void {
  const { cookieOptions } = config;

  reply.setCookie("access_token", accessToken, {
    ...cookieOptions,
    maxAge: 60 * 15, // 15분
  });

  reply.setCookie("refresh_token", refreshToken, {
    ...cookieOptions,
    maxAge: cookieOptions.maxAge, // 7일
  });
}

/**
 * 인증 쿠키 삭제
 */
export function clearAuthCookies(reply: FastifyReply): void {
  const { cookieOptions } = config;
  const clearOptions = { ...cookieOptions, maxAge: 0 };

  reply.clearCookie("access_token", clearOptions);
  reply.clearCookie("refresh_token", clearOptions);
}

/**
 * 세션 정보 조회 (인증 상태 확인용)
 */
export async function getSessionInfo(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      is_active: true,
    },
  });

  // 비활성화된 사용자는 null 반환 (로그아웃 처리)
  if (user && !user.is_active) {
    return null;
  }

  return user;
}
