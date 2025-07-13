import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

const { JsonWebTokenError, TokenExpiredError, NotBeforeError } = jwt;

// 디버그 모드 설정 (개발 환경에서만 상세 오류 표시)
const DEBUG_MODE = process.env.NODE_ENV !== "production";

// 에러 응답 타입
interface ErrorResponse {
  success: false;
  error: string;
  stack?: string;
  details?: any;
  field?: string;
  code?: string;
  status?: number;
}

// 로깅 함수
const logError = (error: Error): void => {
  if (DEBUG_MODE) {
    console.error("Error details:", error);
  }
};

export function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await handler(req, res);
    } catch (e: any) {
      // 기본 응답 설정
      let response: ErrorResponse = {
        success: false,
        error: "알 수 없는 오류가 발생했습니다.",
        ...(DEBUG_MODE && { stack: e.stack }),
      };

      logError(e);

      // Zod 유효성 검증 오류 (Superstruct 대체)
      if (e instanceof ZodError) {
        const fieldErrors = e.errors.map((err: any) => `${err.path.join(".")}: ${err.message}`).join(", ");
        response = {
          success: false,
          error: `입력 데이터 오류: ${fieldErrors}`,
          ...(DEBUG_MODE && { details: e.errors }),
        };
        res.status(400).json(response);
      }
      // Prisma 유효성 검증 오류
      else if (e instanceof Prisma.PrismaClientValidationError) {
        response = {
          success: false,
          error: `입력 데이터 오류: ${e.message}`,
        };
        res.status(400).json(response);
      }
      // Prisma 알려진 요청 오류
      else if (e instanceof Prisma.PrismaClientKnownRequestError) {
        switch (e.code) {
          case "P2000":
            response = {
              success: false,
              error: "입력 데이터 오류: 제공된 값이 해당 컬럼 유형에 비해 너무 깁니다.",
              ...(DEBUG_MODE && { field: e.meta?.target as string }),
            };
            res.status(400).json(response);
            break;

          case "P2001":
            response = {
              success: false,
              error: "데이터 없음 오류: 지정된 조건에 맞는 레코드가 존재하지 않습니다.",
            };
            res.status(404).json(response);
            break;

          case "P2002":
            response = {
              success: false,
              error: `중복된 데이터 오류: ${Array.isArray(e.meta?.target) ? (e.meta.target as string[]).join(", ") : (e.meta?.target as string) || "알 수 없는 필드"}`,
            };
            res.status(409).json(response);
            break;

          case "P2003":
            response = {
              success: false,
              error: "외래 키 제약조건 오류: 참조하는 레코드가 존재하지 않습니다.",
              ...(DEBUG_MODE && { field: e.meta?.field_name as string }),
            };
            res.status(400).json(response);
            break;

          case "P2025":
            response = {
              success: false,
              error: "데이터 없음 오류: 요청한 데이터를 찾을 수 없습니다.",
              ...(DEBUG_MODE && { details: e.meta }),
            };
            res.status(404).json(response);
            break;

          case "P2024":
            response = {
              success: false,
              error: "데이터베이스 연결 오류: 데이터베이스 서버에 연결할 수 없습니다.",
            };
            res.status(503).json(response);
            break;

          default:
            response = {
              success: false,
              error: `데이터베이스 오류: ${e.message}`,
              ...(DEBUG_MODE && { code: e.code }),
            };
            res.status(400).json(response);
        }
      }
      // JWT 토큰 오류 처리 세분화
      else if (e instanceof TokenExpiredError) {
        response = {
          success: false,
          error: "인증 오류: 토큰이 만료되었습니다.",
        };
        res.status(401).json(response);
      } else if (e instanceof NotBeforeError) {
        response = {
          success: false,
          error: "인증 오류: 아직 활성화되지 않은 토큰입니다.",
        };
        res.status(401).json(response);
      } else if (e instanceof JsonWebTokenError) {
        response = {
          success: false,
          error: "인증 오류: 유효하지 않은 토큰입니다.",
        };
        res.status(401).json(response);
      }
      // 일반적인 HTTP 요청 오류
      else if (e.status && e.status >= 400 && e.status < 600) {
        response = {
          success: false,
          error: e.message || "HTTP 요청 오류",
          ...(DEBUG_MODE && { status: e.status }),
        };
        res.status(e.status).json(response);
      }
      // 권한 관련 오류
      else if (e.name === "ForbiddenError" || e.message?.includes("permission")) {
        response = {
          success: false,
          error: "권한 오류: 이 작업을 수행할 권한이 없습니다.",
        };
        res.status(403).json(response);
      }
      // 기타 모든 에러
      else {
        response = {
          success: false,
          error: `서버 오류: ${e.message}`,
        };
        res.status(500).json(response);
      }
    }
  };
}
