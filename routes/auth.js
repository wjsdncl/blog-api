import express from "express";


import { prisma } from "../lib/prismaClient.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { generateTokens } from "../utils/auth.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

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
  sameSite: "none",
  path: "/",
};

// Helper to call GitHub API and throw on non-2xx
async function fetchGitHubJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Log details but only expose generic message to client
    logger.error("GitHub API error", { url, status: res.status, text });
    throw new Error(`GitHub API request failed (${res.status})`);
  }
  return res.json();
}


// GET /auth/github -> GitHub OAuth 로그인
router.get("/github", (req, res) => {
  const isDev = req.headers.origin === "https://localhost:3000";
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${isDev ? GITHUB_CLIENT_ID_DEV : GITHUB_CLIENT_ID}&redirect_uri=${
    isDev ? GITHUB_CALLBACK_URL_DEV : GITHUB_CALLBACK_URL
  }&scope=user:email`;

  logger.info("GitHub OAuth redirect initiated", { isDev, origin: req.headers.origin });
  res.redirect(githubAuthUrl);
});

// GET /auth/github/callback -> GitHub OAuth 콜백 처리
router.get(
  "/github/callback",
  asyncHandler(async (req, res) => {
    const { code } = req.query;
    const isDev = req.headers.origin === "https://localhost:3000";

    if (!code) {
      logger.warn("GitHub OAuth callback missing code parameter");
      return res.status(400).json({
        success: false,
        error: "GitHub 코드를 전달받지 못했습니다.",
      });
    }

    try {
      // GitHub access token 받기
      const tokenData = await fetchGitHubJson("https://github.com/login/oauth/access_token", {
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
      });

      if (!tokenData.access_token) {
        logger.error("Failed to get GitHub access token", { tokenData });
        return res.status(400).json({
          success: false,
          error: "GitHub 토큰을 받아오지 못했습니다.",
        });
      }

      // GitHub 사용자 정보 가져오기
      const userData = await fetchGitHubJson("https://api.github.com/user", {
        headers: {
          Authorization: `token ${tokenData.access_token}`,
        },
      });

      // 이메일 정보 가져오기 (별도 API 호출 필요)
      const emailData = await fetchGitHubJson("https://api.github.com/user/emails", {
        headers: {
          Authorization: `token ${tokenData.access_token}`,
        },
      });
      const primaryEmail = emailData.find((email) => email.primary)?.email;

      if (!primaryEmail) {
        logger.error("GitHub user has no primary email", { userData });
        return res.status(400).json({
          success: false,
          error: "GitHub 계정에 이메일이 설정되어 있지 않습니다.",
        });
      }

      // 사용자 찾기 또는 생성
      let user = await prisma.user.findUnique({
        where: { email: primaryEmail },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: primaryEmail,
            name: userData.name || userData.login,
          },
        });
        logger.info("New user created via GitHub OAuth", { userId: user.id, email: primaryEmail });
      } else {
        logger.info("Existing user logged in via GitHub OAuth", { userId: user.id, email: primaryEmail });
      }

      // JWT 토큰 생성
      const { accessToken, refreshToken } = generateTokens(user.id);

      res.status(200).json({
        success: true,
        data: { user, accessToken, refreshToken },
      });
    } catch (error) {
      logger.error("GitHub OAuth callback error", { error: error.message, stack: error.stack });
      // 외부 API 오류일 경우 502, 기타는 500
      const status = error.message.startsWith("GitHub API request failed") ? 502 : 500;
      res.status(status).json({
        success: false,
        error: status === 502 ? "GitHub API 호출 중 오류가 발생했습니다." : "GitHub 로그인 처리 중 서버 오류가 발생했습니다.",
      });
    }
  })
);


// POST /auth/logout -> 로그아웃
router.post("/logout", (req, res) => {
  res.clearCookie("accessToken", DEFAULT_COOKIE_OPTIONS);
  res.clearCookie("refreshToken", DEFAULT_COOKIE_OPTIONS);

  logger.info("User logged out");

  res.json({
    success: true,
    message: "로그아웃 되었습니다.",
  });
});

export default router;
