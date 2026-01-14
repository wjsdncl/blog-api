import * as dotenv from "dotenv";
import type { Config } from "@/types/environment.js";
import { REQUIRED_ENV_VARS } from "@/types/environment.js";

dotenv.config();

// 필수 환경 변수 검증
const missingVars = REQUIRED_ENV_VARS.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
}

const isProduction = process.env.NODE_ENV === "production";

export const config: Config = {
  // 서버 설정
  port: Number(process.env.PORT) || 8000,
  nodeEnv: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",

  // 데이터베이스
  databaseUrl: process.env.DATABASE_URL!,

  // JWT 설정
  jwtSecret: process.env.JWT_SECRET!,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,

  // Supabase 설정
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,

  // OAuth 설정 (공통 callbackUrl 사용)
  oauthCallbackUrl: process.env.OAUTH_CALLBACK_URL || "http://localhost:8000/auth/oauth/callback",
  oauth: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },

  // CORS 설정
  corsOrigins: [
    "http://localhost:3000",
    "https://localhost:3000",
    process.env.FRONTEND_URL || "",
  ].filter(Boolean),

  // 로깅 설정
  logLevel: process.env.LOG_LEVEL || "info",

  // 쿠키 설정
  cookieOptions: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "lax" : "none",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7일 (초 단위)
  },

  // Swagger 설정
  swagger: {
    enabled: process.env.SWAGGER_ENABLED !== "false", // 기본값: true
    username: process.env.SWAGGER_USERNAME || "admin",
    password: process.env.SWAGGER_PASSWORD || "swagger-secret",
    hideAdminEndpoints: process.env.SWAGGER_HIDE_ADMIN === "true", // 기본값: false
  },
};
