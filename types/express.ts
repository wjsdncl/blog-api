import { Request } from "express";
import { User as PrismaUser } from "@prisma/client";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";

// JWT 토큰에서 나오는 사용자 정보 타입
export interface User extends Partial<PrismaUser> {
  userId: string;
  id?: string;
  email?: string;
  name?: string;
  isOwner?: boolean;
}

// Express Request 확장
export interface AuthenticatedRequest extends Request {
  user?: User | null;
}

// Express Response 타입 확장을 위한 제네릭 타입
export interface TypedRequest<TBody = any, TQuery = ParsedQs, TParams extends ParamsDictionary = ParamsDictionary> extends Request<TParams, any, TBody, TQuery> {
  // 추가 속성이 필요한 경우 여기에 정의
}

// 인증된 요청 + 타입 지정
export interface AuthenticatedTypedRequest<TBody = any, TQuery = ParsedQs, TParams extends ParamsDictionary = ParamsDictionary> extends TypedRequest<TBody, TQuery, TParams> {
  user?: User | null;
}
