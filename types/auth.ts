// JWT 및 인증 관련 타입
export interface JwtPayload {
  userId: string;
  email: string;
  [key: string]: any;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
