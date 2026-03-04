/**
 * 인증 미들웨어 (Fastify preHandler)
 *
 * 인증 흐름:
 * 1. Authorization 헤더에서 Access Token 추출
 * 2. 토큰 유효 → DB에서 최신 사용자 정보 조회 후 request.user에 할당
 * 3. 토큰 만료 + Refresh Token 존재 → 새 토큰 쌍 발급 (응답 헤더에 포함)
 * 4. 토큰 무효 → isRequired에 따라 401 반환 또는 user=null로 통과
 */
import { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken, verifyRefreshToken, generateTokens } from "@/utils/auth.js";
import { prisma } from "@/lib/prismaClient.js";
import { logger } from "@/utils/logger.js";
import { AuthenticatedRequest, User } from "@/types/fastify.js";

async function handleAuthentication(
  request: FastifyRequest,
  reply: FastifyReply,
  isRequired: boolean
): Promise<void> {
  const authHeader = request.headers.authorization;
  const refreshToken = request.headers["x-refresh-token"] as string;

  if (!authHeader) {
    if (isRequired) {
      logger.warn("Missing authorization header", {
        ip: request.ip,
        userAgent: request.headers["user-agent"],
      });
      return reply.status(401).send({
        success: false,
        error: "로그인이 필요합니다.",
      });
    } else {
      request.user = null;
      return;
    }
  }

  const accessToken = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(accessToken);
    // Fetch full user details to attach roles/flags
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          role: true,
          email: true,
          username: true,
        },
      });

      if (dbUser) {
        request.user = {
          userId: decoded.userId,
          id: dbUser.id,
          role: dbUser.role,
          email: dbUser.email,
          username: dbUser.username,
        } as User;
      } else {
        request.user = decoded as User;
      }
    } catch (dbErr: unknown) {
      logger.error("Failed to fetch user during auth", { error: dbErr instanceof Error ? dbErr.message : String(dbErr) });
      request.user = decoded as User; // fallback
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "TokenExpiredError" && refreshToken) {
      try {
        const refreshDecoded = verifyRefreshToken(refreshToken);
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(
          refreshDecoded.userId,
          refreshDecoded.email || ""
        );

        reply.header("Authorization", `Bearer ${newAccessToken}`);
        reply.header("X-Refresh-Token", newRefreshToken);

        request.user = refreshDecoded as User;
        logger.info("Token refreshed", { userId: refreshDecoded.userId });
      } catch (refreshErr: unknown) {
        logger.warn("Refresh token verification failed", {
          error: refreshErr instanceof Error ? refreshErr.message : String(refreshErr),
          ip: request.ip,
        });
        if (isRequired) {
          return reply.status(401).send({
            success: false,
            error: "세션이 만료되었습니다. 다시 로그인해주세요.",
          });
        } else {
          request.user = null;
        }
      }
    } else {
      logger.warn("Access token verification failed", {
        error: err instanceof Error ? err.message : String(err),
        ip: request.ip,
      });
      if (isRequired) {
        return reply.status(401).send({
          success: false,
          error: "인증에 실패했습니다.",
        });
      } else {
        request.user = null;
      }
    }
  }
}

/** 인증 필수 — 미인증 시 401 */
export async function requiredAuthenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await handleAuthentication(request, reply, true);
}

/** 인증 선택 — 미인증이어도 통과 (user=null) */
export async function optionalAuthenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await handleAuthentication(request, reply, false);
}

/** OWNER 전용 — 인증 확인 후 role=OWNER가 아니면 403 */
export async function requireOwner(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requiredAuthenticate(request, reply);
  if (reply.sent) return;

  if (request.user?.role !== "OWNER") {
    logger.warn("Owner access attempt by non-owner user", {
      userId: request.user?.userId,
      role: request.user?.role,
      ip: request.ip,
    });
    return reply.status(403).send({
      success: false,
      error: "블로그 소유자 권한이 필요합니다.",
    });
  }
}
