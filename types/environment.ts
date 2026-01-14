// 환경 변수 타입 정의
export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
}

export interface Config {
  // 서버 설정
  port: number;
  nodeEnv: string;
  frontendUrl: string;

  // 데이터베이스
  databaseUrl: string;

  // JWT 설정
  jwtSecret: string;
  jwtRefreshSecret: string;

  // Supabase 설정
  supabaseUrl: string;
  supabaseAnonKey: string;

  // OAuth 설정 (공통 callbackUrl 사용)
  oauthCallbackUrl: string;
  oauth: {
    github: OAuthProviderConfig;
    google: OAuthProviderConfig;
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
    maxAge: number;
  };

  // Swagger 설정
  swagger: {
    enabled: boolean;
    username: string;
    password: string;
    hideAdminEndpoints: boolean;
  };
}

// 필수 환경 변수들
export const REQUIRED_ENV_VARS = ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET", "SUPABASE_URL", "SUPABASE_ANON_KEY"] as const;

export type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];
