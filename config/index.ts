import * as dotenv from "dotenv";
import type { Config } from "../types/environment.js";
import { REQUIRED_ENV_VARS } from "../types/environment.js";

dotenv.config();

// 필수 환경 변수 검증
const missingVars = REQUIRED_ENV_VARS.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
}

export const config: Config = {
  // 서버 설정
  port: Number(process.env.PORT) || 8000,
  nodeEnv: process.env.NODE_ENV || "development",

  // 데이터베이스
  databaseUrl: process.env.DATABASE_URL!,

  // JWT 설정
  jwtSecret: process.env.JWT_SECRET!,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,

  // Supabase 설정
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,

  // GitHub OAuth 설정
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackUrl: process.env.GITHUB_CALLBACK_URL,
    clientIdDev: process.env.GITHUB_CLIENT_ID_DEV,
    clientSecretDev: process.env.GITHUB_CLIENT_SECRET_DEV,
    callbackUrlDev: process.env.GITHUB_CALLBACK_URL_DEV,
  },

  // CORS 설정
  corsOrigins: ["http://localhost:3000", "https://localhost:3000", "https://wjsdncl-dev-hub.vercel.app", "https://www.wjdalswo-dev.xyz", "https://github.com/"],

  // 로깅 설정
  logLevel: process.env.LOG_LEVEL || "info",

  // 쿠키 설정
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
    path: "/",
  },
};
