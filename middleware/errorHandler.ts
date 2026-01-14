import { FastifyRequest, FastifyReply, FastifyError } from "fastify";
import jwt from "jsonwebtoken";
import { Prisma } from "@/lib/generated/prisma/client.js";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors.js";
import { logger } from "@/utils/logger.js";

const { JsonWebTokenError, TokenExpiredError, NotBeforeError } = jwt;

// 디버그 모드 설정 (개발 환경에서만 상세 오류 표시)
const DEBUG_MODE = process.env.NODE_ENV !== "production";

// 에러 응답 타입
interface ErrorResponse {
  success: false;
  error: string;
  stack?: string;
  details?: Record<string, string[]> | unknown;
  field?: string;
  code?: string;
  status?: number;
}

// Fastify 에러 핸들러
export async function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 기본 응답 설정
  let response: ErrorResponse = {
    success: false,
    error: "알 수 없는 오류가 발생했습니다.",
    ...(DEBUG_MODE && { stack: error.stack }),
  };

  // 에러 로깅
  logger.error("Request error", {
    message: error.message,
    name: error.name,
    stack: error.stack,
    url: request.url,
    method: request.method,
    ip: request.ip,
  });

  // Zod 유효성 검증 오류
  if (error instanceof ZodError) {
    const fieldErrors = error.issues.map((err: any) => `${err.path.join(".")}: ${err.message}`).join(", ");
    response = {
      success: false,
      error: `입력 데이터 오류: ${fieldErrors}`,
      ...(DEBUG_MODE && { details: error.issues }),
    };
    return reply.status(400).send(response);
  }
  // Prisma 유효성 검증 오류
  else if (error instanceof Prisma.PrismaClientValidationError) {
    response = {
      success: false,
      error: `입력 데이터 오류: ${error.message}`,
    };
    return reply.status(400).send(response);
  }
  // Prisma 알려진 요청 오류
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2000":
        response = {
          success: false,
          error: "입력 데이터 오류: 제공된 값이 해당 컬럼 유형에 비해 너무 깁니다.",
          ...(DEBUG_MODE && { field: error.meta?.target as string }),
        };
        return reply.status(400).send(response);

      case "P2001":
        response = {
          success: false,
          error: "데이터 없음 오류: 지정된 조건에 맞는 레코드가 존재하지 않습니다.",
        };
        return reply.status(404).send(response);

      case "P2002":
        response = {
          success: false,
          error: `중복된 데이터 오류: ${
            Array.isArray(error.meta?.target)
              ? (error.meta.target as string[]).join(", ")
              : (error.meta?.target as string) || "알 수 없는 필드"
          }`,
        };
        return reply.status(409).send(response);

      case "P2003":
        response = {
          success: false,
          error: "외래 키 제약조건 오류: 참조하는 레코드가 존재하지 않습니다.",
          ...(DEBUG_MODE && { field: error.meta?.field_name as string }),
        };
        return reply.status(400).send(response);

      case "P2025":
        response = {
          success: false,
          error: "데이터 없음 오류: 요청한 데이터를 찾을 수 없습니다.",
          ...(DEBUG_MODE && { details: error.meta }),
        };
        return reply.status(404).send(response);

      case "P2024":
        response = {
          success: false,
          error: "데이터베이스 연결 오류: 데이터베이스 서버에 연결할 수 없습니다.",
        };
        return reply.status(503).send(response);

      default:
        response = {
          success: false,
          error: `데이터베이스 오류: ${error.message}`,
          ...(DEBUG_MODE && { code: error.code }),
        };
        return reply.status(400).send(response);
    }
  }
  // JWT 토큰 오류 처리 세분화
  else if (error instanceof TokenExpiredError) {
    response = {
      success: false,
      error: "인증 오류: 토큰이 만료되었습니다.",
    };
    return reply.status(401).send(response);
  } else if (error instanceof NotBeforeError) {
    response = {
      success: false,
      error: "인증 오류: 아직 활성화되지 않은 토큰입니다.",
    };
    return reply.status(401).send(response);
  } else if (error instanceof JsonWebTokenError) {
    response = {
      success: false,
      error: "인증 오류: 유효하지 않은 토큰입니다.",
    };
    return reply.status(401).send(response);
  }
  // 커스텀 AppError 처리
  else if (error instanceof AppError) {
    response = {
      success: false,
      error: error.message,
      code: error.code,
    };
    return reply.status(error.statusCode).send(response);
  }
  // Fastify 에러
  else if ("statusCode" in error && error.statusCode) {
    response = {
      success: false,
      error: error.message || "HTTP 요청 오류",
      ...(DEBUG_MODE && { status: error.statusCode }),
    };
    return reply.status(error.statusCode).send(response);
  }
  // 기타 모든 에러
  else {
    response = {
      success: false,
      error: `서버 오류: ${error.message}`,
    };
    return reply.status(500).send(response);
  }
}
