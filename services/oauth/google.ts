/**
 * Google OAuth Service
 */
import { config } from "@/config/index.js";
import { logger } from "@/utils/logger.js";
import { BadRequestError } from "@/lib/errors.js";
import type {
  IOAuthService,
  OAuthUserInfo,
  GoogleTokenResponse,
  GoogleUserResponse,
} from "./types.js";

class GoogleOAuthService implements IOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;

  constructor() {
    this.clientId = config.oauth.google.clientId;
    this.clientSecret = config.oauth.google.clientSecret;
    this.callbackUrl = config.oauthCallbackUrl;
  }

  /**
   * OAuth 설정 확인
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.callbackUrl);
  }

  /**
   * Google OAuth 인증 URL 생성
   */
  getAuthUrl(state: string): string {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", this.callbackUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    return url.toString();
  }

  /**
   * Authorization code를 access token으로 교환
   */
  async exchangeCode(code: string): Promise<string> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.callbackUrl,
      }).toString(),
    });

    const data = (await response.json()) as GoogleTokenResponse;

    if (!response.ok || data.error || !data.access_token) {
      logger.error("Google token exchange failed", {
        error: data.error,
        description: data.error_description,
      });
      throw new BadRequestError(data.error_description || "Google 토큰 교환에 실패했습니다.");
    }

    return data.access_token;
  }

  /**
   * Google 사용자 정보 조회
   */
  async fetchUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      logger.error("Google user fetch failed", { status: response.status });
      throw new BadRequestError("Google 사용자 정보를 가져올 수 없습니다.");
    }

    const userData = (await response.json()) as GoogleUserResponse;

    if (!userData.verified_email) {
      logger.warn("Google user email not verified", { googleId: userData.id });
      throw new BadRequestError("이메일이 인증되지 않았습니다. Google에서 이메일을 인증해주세요.");
    }

    return {
      provider: "GOOGLE",
      providerId: userData.id,
      email: userData.email,
      username: userData.name,
    };
  }
}

// 싱글톤 인스턴스
export const googleOAuthService = new GoogleOAuthService();
