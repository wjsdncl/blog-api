/**
 * JWT 토큰 유틸리티
 *
 * Access Token: 15분 (짧은 주기로 탈취 피해 최소화)
 * Refresh Token: 7일 (미들웨어에서 자동 갱신)
 */
import jwt from "jsonwebtoken";
import type { JwtPayload, TokenPair } from "@/types/auth.js";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error("JWT secrets are required in environment variables");
}

export function generateTokens(userId: string, email: string, role: string, username: string): TokenPair {
  const payload: Omit<JwtPayload, "iat" | "exp"> = {
    userId,
    email,
    role,
    username,
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

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (typeof decoded === "string") throw new Error("Unexpected JWT payload format");
  return decoded as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
  if (typeof decoded === "string") throw new Error("Unexpected JWT payload format");
  return decoded as JwtPayload;
}
