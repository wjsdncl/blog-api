import jwt from "jsonwebtoken";
import type { JwtPayload, TokenPair } from "../types/auth.js";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error("JWT secrets are required in environment variables");
}

// JWT 토큰 생성 함수 (보안 강화: 15분 AccessToken)
export function generateTokens(userId: string, email: string): TokenPair {
  const payload: Omit<JwtPayload, "iat" | "exp"> = {
    userId,
    email,
  };

  const accessToken = jwt.sign(
    payload,
    JWT_SECRET,
    { expiresIn: "15m" } // 15분으로 단축
  );

  const refreshToken = jwt.sign(
    payload,
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" } // 7일 유지
  );

  return { accessToken, refreshToken };
}

// 토큰 검증 함수
export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
  return decoded as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
  return decoded as JwtPayload;
}

// 토큰에서 Bearer 제거
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}
