// JWT 페이로드 타입
export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// JWT 토큰 쌍 타입
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// GitHub OAuth 응답 타입
export interface GitHubOAuthResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

// GitHub 사용자 정보 타입
export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
  html_url: string;
}

// 로그인 응답 타입
export interface LoginResponse {
  user: {
    id: string;
    name: string;
    email: string;
    profilePicUrl?: string;
    isOwner: boolean;
  };
  tokens: TokenPair;
}
