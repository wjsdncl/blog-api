/**
 * OAuth 공통 타입 정의
 */

export type OAuthProvider = "GITHUB" | "GOOGLE";

/**
 * OAuth 사용자 정보 (공통)
 */
export interface OAuthUserInfo {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  username: string;
}

/**
 * OAuth 서비스 인터페이스
 */
export interface IOAuthService {
  /**
   * OAuth 설정 확인
   */
  isConfigured(): boolean;

  /**
   * OAuth 인증 URL 생성
   */
  getAuthUrl(state: string): string;

  /**
   * Authorization code를 access token으로 교환
   */
  exchangeCode(code: string): Promise<string>;

  /**
   * 사용자 정보 조회
   */
  fetchUserInfo(accessToken: string): Promise<OAuthUserInfo>;
}

// ============================================
// GitHub 타입
// ============================================

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

export interface GitHubUserResponse {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
}

export interface GitHubEmailResponse {
  email: string;
  primary: boolean;
  verified: boolean;
}

// ============================================
// Google 타입
// ============================================

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

export interface GoogleUserResponse {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  picture: string;
}
