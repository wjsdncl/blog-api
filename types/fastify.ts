/**
 * Fastify 요청 타입 확장
 *
 * request.user: 인증 미들웨어가 JWT 페이로드에서 할당
 * request.startTime: 요청 소요시간 측정용 (app.ts onRequest 훅에서 설정)
 */
import { FastifyRequest } from "fastify";
import { role } from "@/lib/generated/prisma/client.js";

/** JWT 페이로드 기반 사용자 타입 */
export interface User {
  userId: string;
  id: string;
  email: string;
  username: string;
  role: role;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: User | null;
    startTime?: number;
  }
}

/** 인증 확정 요청 — preHandler에서 인증 통과 후 사용 */
export interface AuthenticatedRequest extends FastifyRequest {
  user: User & { id: string; role: role };
}
