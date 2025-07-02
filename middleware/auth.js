import { verifyAccessToken, verifyRefreshToken, generateTokens } from "../utils/auth.js";
import { logger } from "../utils/logger.js";

// 공통 인증 처리 함수
function handleAuthentication(req, res, next, isRequired) {
  const authHeader = req.headers.authorization;
  const refreshToken = req.headers["x-refresh-token"];

  if (!authHeader) {
    if (isRequired) {
      logger.warn("Missing authorization header", { ip: req.ip, userAgent: req.get("User-Agent") });
      res.status(401).json({
        success: false,
        error: "로그인이 필요합니다.",
      });
      return;
    } else {
      req.user = null;
      next();
      return;
    }
  }

  const accessToken = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(accessToken);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError" && refreshToken) {
      try {
        const refreshDecoded = verifyRefreshToken(refreshToken);
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(refreshDecoded.userId);

        res.setHeader("Authorization", `Bearer ${newAccessToken}`);
        res.setHeader("X-Refresh-Token", newRefreshToken);

        req.user = refreshDecoded;
        logger.info("Token refreshed", { userId: refreshDecoded.userId });
        next();
      } catch (refreshErr) {
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
          req.user = null;
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
        req.user = null;
        next();
      }
    }
  }
}

// 필수 인증 미들웨어
export function requiredAuthenticate(req, res, next) {
  handleAuthentication(req, res, next, true);
}

// 선택적 인증 미들웨어
export function optionalAuthenticate(req, res, next) {
  handleAuthentication(req, res, next, false);
}

// 관리자 권한 확인 미들웨어
export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    logger.warn("Admin access attempt by non-admin user", {
      userId: req.user?.userId,
      ip: req.ip,
    });
    return res.status(403).json({
      success: false,
      error: "관리자 권한이 필요합니다.",
    });
  }
  next();
}
