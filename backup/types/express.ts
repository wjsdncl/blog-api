import { FastifyRequest } from "fastify";
import { User as PrismaUser } from "@prisma/client";

// JWT 토큰에서 나오는 사용자 정보 타입
export interface User extends Partial<PrismaUser> {
  userId: string;
  id?: string;
  email?: string;
  name?: string;
  isOwner?: boolean;
}

// Fastify Request 확장
declare module "fastify" {
  interface FastifyRequest {
    user?: User | null;
    startTime?: number;
  }
}

// 인증된 요청 타입
export interface AuthenticatedRequest extends FastifyRequest {
  user: User;
}

// 제네릭 타입 요청
export interface TypedRequest<TBody = any, TQuery = any, TParams = any> extends FastifyRequest {
  body: TBody;
  query: TQuery;
  params: TParams;
}

// 인증된 요청 + 타입 지정
export interface AuthenticatedTypedRequest<TBody = any, TQuery = any, TParams = any>
  extends TypedRequest<TBody, TQuery, TParams> {
  user: User;
}
