import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prismaClient.js";
import { generateTokens } from "../utils/auth.js";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // GitHub OAuth Configuration
  const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
  const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
  const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL;

  const GITHUB_CLIENT_ID_DEV = process.env.GITHUB_CLIENT_ID_DEV;
  const GITHUB_CLIENT_SECRET_DEV = process.env.GITHUB_CLIENT_SECRET_DEV;
  const GITHUB_CALLBACK_URL_DEV = process.env.GITHUB_CALLBACK_URL_DEV;

  const DEFAULT_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none" as const,
    path: "/",
  };

  // GitHub API 응답 타입
  interface GitHubTokenResponse {
    access_token: string;
    token_type: string;
    scope: string;
  }

  interface GitHubUserResponse {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
  }

  interface GitHubEmailResponse {
    email: string;
    primary: boolean;
    verified: boolean;
  }

  // Helper to call GitHub API
  async function fetchGitHubJson<T>(url: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      fastify.log.error({ url, status: res.status, text }, "GitHub API error");
      throw new Error(`GitHub API request failed (${res.status})`);
    }
    return res.json() as Promise<T>;
  }

  // GET /auth/github -> GitHub OAuth 로그인
  fastify.get("/github", async (request, reply) => {
    const isDev = request.headers.origin === "https://localhost:3000";
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${
      isDev ? GITHUB_CLIENT_ID_DEV : GITHUB_CLIENT_ID
    }&redirect_uri=${isDev ? GITHUB_CALLBACK_URL_DEV : GITHUB_CALLBACK_URL}&scope=user:email`;

    fastify.log.info({ isDev, origin: request.headers.origin }, "GitHub OAuth redirect initiated");
    reply.redirect(githubAuthUrl);
  });

  // GET /auth/github/callback -> GitHub OAuth 콜백 처리
  const callbackQuerySchema = z.object({
    code: z.string(),
  });

  fastify.get("/github/callback", async (request, reply) => {
    const parseResult = callbackQuerySchema.safeParse(request.query);

    if (!parseResult.success) {
      fastify.log.warn("GitHub OAuth callback missing code parameter");
      return reply.status(400).send({
        success: false,
        error: "GitHub 코드를 전달받지 못했습니다.",
      });
    }

    const { code } = parseResult.data;
    const isDev = request.headers.origin === "https://localhost:3000";

    try {
      // GitHub access token 받기
      const tokenData = await fetchGitHubJson<GitHubTokenResponse>(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            client_id: isDev ? GITHUB_CLIENT_ID_DEV : GITHUB_CLIENT_ID,
            client_secret: isDev ? GITHUB_CLIENT_SECRET_DEV : GITHUB_CLIENT_SECRET,
            code,
          }),
        }
      );

      if (!tokenData.access_token) {
        fastify.log.error({ tokenData }, "Failed to get GitHub access token");
        return reply.status(400).send({
          success: false,
          error: "GitHub 토큰을 받아오지 못했습니다.",
        });
      }

      // GitHub 사용자 정보 가져오기
      const userData = await fetchGitHubJson<GitHubUserResponse>("https://api.github.com/user", {
        headers: {
          Authorization: `token ${tokenData.access_token}`,
        },
      });

      // 이메일 정보 가져오기
      const emailData = await fetchGitHubJson<GitHubEmailResponse[]>("https://api.github.com/user/emails", {
        headers: {
          Authorization: `token ${tokenData.access_token}`,
        },
      });
      const primaryEmail = emailData.find((email) => email.primary)?.email;

      if (!primaryEmail) {
        fastify.log.error({ userData }, "GitHub user has no primary email");
        return reply.status(400).send({
          success: false,
          error: "GitHub 계정에 이메일이 설정되어 있지 않습니다.",
        });
      }

      // 사용자 찾기 또는 생성
      let user = await prisma.user.findUnique({
        where: { email: primaryEmail },
      });

      let auth;
      if (!user) {
        // 새 사용자 생성 (User + Auth)
        user = await prisma.user.create({
          data: {
            email: primaryEmail,
            username: userData.name || userData.login,
            role: "USER",
          },
        });

        auth = await prisma.auth.create({
          data: {
            user_id: user.id,
            provider: "GITHUB",
            provider_id: userData.id.toString(),
          },
        });

        fastify.log.info({ userId: user.id, email: primaryEmail }, "New user created via GitHub OAuth");
      } else {
        // 기존 사용자의 Auth 정보 확인
        auth = await prisma.auth.findFirst({
          where: {
            user_id: user.id,
            provider: "GITHUB",
          },
        });

        if (!auth) {
          // Auth 정보 생성
          auth = await prisma.auth.create({
            data: {
              user_id: user.id,
              provider: "GITHUB",
              provider_id: userData.id.toString(),
            },
          });
        }

        fastify.log.info(
          { userId: user.id, email: primaryEmail },
          "Existing user logged in via GitHub OAuth"
        );
      }

      // JWT 토큰 생성
      const { accessToken, refreshToken } = generateTokens(user.id, user.email);

      return reply.status(200).send({
        success: true,
        data: { user, accessToken, refreshToken },
      });
    } catch (error: any) {
      fastify.log.error({ error: error.message, stack: error.stack }, "GitHub OAuth callback error");
      const status = error.message.startsWith("GitHub API request failed") ? 502 : 500;
      return reply.status(status).send({
        success: false,
        error:
          status === 502
            ? "GitHub API 호출 중 오류가 발생했습니다."
            : "GitHub 로그인 처리 중 서버 오류가 발생했습니다.",
      });
    }
  });

  // POST /auth/logout -> 로그아웃
  fastify.post("/logout", async (request, reply) => {
    reply.clearCookie("accessToken", DEFAULT_COOKIE_OPTIONS);
    reply.clearCookie("refreshToken", DEFAULT_COOKIE_OPTIONS);

    fastify.log.info("User logged out");

    return reply.send({
      success: true,
      message: "로그아웃 되었습니다.",
    });
  });
};

export default authRoutes;
