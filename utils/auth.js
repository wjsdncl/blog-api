import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error("JWT secrets are required in environment variables");
}

// JWT 토큰 생성 함수 (보안 강화: 15분 AccessToken)
export function generateTokens(userId) {
  const accessToken = jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: "15m" } // 15분으로 단축
  );

  const refreshToken = jwt.sign(
    { userId },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" } // 7일 유지
  );

  return { accessToken, refreshToken };
}

// 토큰 검증 함수
export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}
