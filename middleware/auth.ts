import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";
import { verifyAccessToken, verifyRefreshToken, generateTokens } from "@/utils/auth.js";
import { prisma } from "@/lib/prismaClient.js";
import { logger } from "@/utils/logger.js";
import { AuthenticatedRequest, User } from "@/types/fastify.js";

// 공통 인증 처리 함수
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
          ...decoded,
          ...dbUser,
          userId: decoded.userId, // ensure JWT userId field kept
        } as User;
      } else {
        request.user = decoded as User;
      }
    } catch (dbErr: any) {
      logger.error("Failed to fetch user during auth", { error: dbErr.message });
      request.user = decoded as User; // fallback
    }
  } catch (err: any) {
    if (err.name === "TokenExpiredError" && refreshToken) {
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
      } catch (refreshErr: any) {
        logger.warn("Refresh token verification failed", {
          error: refreshErr.message,
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
        error: err.message,
        ip: request.ip,
      });
      if (isRequired) {
        return reply.status(403).send({
          success: false,
          error: "인증에 실패했습니다.",
        });
      } else {
        request.user = null;
      }
    }
  }
}

// 필수 인증 훅
export async function requiredAuthenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await handleAuthentication(request, reply, true);
}

// 선택적 인증 훅
export async function optionalAuthenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await handleAuthentication(request, reply, false);
}

// 관리자 권한 확인 훅
export async function requireOwner(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // 먼저 인증 확인
  await requiredAuthenticate(request, reply);
  if (reply.sent) return;

  // OWNER 역할 확인
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
