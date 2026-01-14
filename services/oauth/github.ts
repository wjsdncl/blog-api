/**
 * GitHub OAuth Service
 */
import { config } from "@/config/index.js";
import { logger } from "@/utils/logger.js";
import { BadRequestError } from "@/lib/errors.js";
import type {
  IOAuthService,
  OAuthUserInfo,
  GitHubTokenResponse,
  GitHubUserResponse,
  GitHubEmailResponse,
} from "./types.js";

class GitHubOAuthService implements IOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;

  constructor() {
    this.clientId = config.oauth.github.clientId;
    this.clientSecret = config.oauth.github.clientSecret;
    this.callbackUrl = config.oauthCallbackUrl;
  }

  /**
   * OAuth 설정 확인
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.callbackUrl);
  }

  /**
   * GitHub OAuth 인증 URL 생성
   */
  getAuthUrl(state: string): string {
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", this.callbackUrl);
    url.searchParams.set("scope", "user:email");
    url.searchParams.set("state", state);
    return url.toString();
  }

  /**
   * Authorization code를 access token으로 교환
   */
  async exchangeCode(code: string): Promise<string> {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.callbackUrl,
      }),
    });

    const data = (await response.json()) as GitHubTokenResponse;

    if (!response.ok || data.error || !data.access_token) {
      logger.error("GitHub token exchange failed", {
        error: data.error,
        description: data.error_description,
      });
      throw new BadRequestError(data.error_description || "GitHub 토큰 교환에 실패했습니다.");
    }

    return data.access_token;
  }

  /**
   * GitHub 사용자 정보 조회
   */
  async fetchUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    // 1. 사용자 기본 정보 조회
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!userResponse.ok) {
      logger.error("GitHub user fetch failed", { status: userResponse.status });
      throw new BadRequestError("GitHub 사용자 정보를 가져올 수 없습니다.");
    }

    const userData = (await userResponse.json()) as GitHubUserResponse;

    // 2. 이메일 정보 조회
    const emailResponse = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!emailResponse.ok) {
      logger.error("GitHub email fetch failed", { status: emailResponse.status });
      throw new BadRequestError("GitHub 이메일 정보를 가져올 수 없습니다.");
    }

    const emailData = (await emailResponse.json()) as GitHubEmailResponse[];
    const primaryEmail = emailData.find((e) => e.primary && e.verified)?.email;

    if (!primaryEmail) {
      logger.warn("GitHub user has no verified primary email", { githubId: userData.id });
      throw new BadRequestError("인증된 이메일이 없습니다. GitHub에서 이메일을 인증해주세요.");
    }

    return {
      provider: "GITHUB",
      providerId: userData.id.toString(),
      email: primaryEmail,
      username: userData.name || userData.login,
    };
  }
}

// 싱글톤 인스턴스
export const githubOAuthService = new GitHubOAuthService();
