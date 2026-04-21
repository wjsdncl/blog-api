// JWT 및 인증 관련 타입
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  username: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
