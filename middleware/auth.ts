import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, verifyRefreshToken, generateTokens } from "../utils/auth.js";
import { prisma } from "../lib/prismaClient.js";
import { logger } from "../utils/logger.js";
import { AuthenticatedRequest, User } from "../types/express.js";

// 공통 인증 처리 함수
async function handleAuthentication(req: Request, res: Response, next: NextFunction, isRequired: boolean): Promise<void> {
  const authHeader = req.headers.authorization;
  const refreshToken = req.headers["x-refresh-token"] as string;

  if (!authHeader) {
    if (isRequired) {
      logger.warn("Missing authorization header", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      res.status(401).json({
        success: false,
        error: "로그인이 필요합니다.",
      });
      return;
    } else {
      (req as AuthenticatedRequest).user = null;
      next();
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
          isOwner: true,
          email: true,
          name: true,
        },
      });

      if (dbUser) {
        (req as AuthenticatedRequest).user = {
          ...decoded,
          ...dbUser,
          userId: decoded.userId, // ensure JWT userId field kept
        } as User;
      } else {
        (req as AuthenticatedRequest).user = decoded as User;
      }
    } catch (dbErr: any) {
      logger.error("Failed to fetch user during auth", { error: dbErr.message });
      (req as AuthenticatedRequest).user = decoded as User; // fallback
    }
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError" && refreshToken) {
      try {
        const refreshDecoded = verifyRefreshToken(refreshToken);
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(refreshDecoded.userId, refreshDecoded.email || "");

        res.setHeader("Authorization", `Bearer ${newAccessToken}`);
        res.setHeader("X-Refresh-Token", newRefreshToken);

        (req as AuthenticatedRequest).user = refreshDecoded as User;
        logger.info("Token refreshed", { userId: refreshDecoded.userId });
        next();
      } catch (refreshErr: any) {
        logger.warn("Refresh token verification failed", {
          error: refreshErr.message,
          ip: req.ip,
        });
        if (isRequired) {
          res.status(401).json({
            success: false,
            error: "세션이 만료되었습니다. 다시 로그인해주세요.",
          });
        } else {
          (req as AuthenticatedRequest).user = null;
          next();
        }
      }
    } else {
      logger.warn("Access token verification failed", {
        error: err.message,
        ip: req.ip,
      });
      if (isRequired) {
        res.status(403).json({
          success: false,
          error: "인증에 실패했습니다.",
        });
      } else {
        (req as AuthenticatedRequest).user = null;
        next();
      }
    }
  }
}

// 필수 인증 미들웨어
export async function requiredAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  await handleAuthentication(req, res, next, true);
}

// 선택적 인증 미들웨어
export async function optionalAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  await handleAuthentication(req, res, next, false);
}

// 관리자 권한 확인 미들웨어
export function requireOwner(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user?.isOwner) {
    logger.warn("Owner access attempt by non-owner user", {
      userId: req.user?.userId,
      ip: req.ip,
    });
    res.status(403).json({
      success: false,
      error: "블로그 소유자 권한이 필요합니다.",
    });
    return;
  }
  next();
}
