// 환경 변수 타입 정의
export interface Config {
  // 서버 설정
  port: number;
  nodeEnv: string;

  // 데이터베이스
  databaseUrl: string;

  // JWT 설정
  jwtSecret: string;
  jwtRefreshSecret: string;

  // Supabase 설정
  supabaseUrl: string;
  supabaseAnonKey: string;

  // GitHub OAuth 설정
  github: {
    clientId?: string;
    clientSecret?: string;
    callbackUrl?: string;
    clientIdDev?: string;
    clientSecretDev?: string;
    callbackUrlDev?: string;
  };

  // CORS 설정
  corsOrigins: string[];

  // 로깅 설정
  logLevel: string;

  // 쿠키 설정
  cookieOptions: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "none" | "lax" | "strict";
    path: string;
  };
}

// 필수 환경 변수들
export const REQUIRED_ENV_VARS = ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET", "SUPABASE_URL", "SUPABASE_ANON_KEY"] as const;

export type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];
