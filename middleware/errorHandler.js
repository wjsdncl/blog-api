import pkg from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { StructError } from "superstruct";

const { JsonWebTokenError } = pkg;

export function asyncHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      let response = {
        success: false,
        error: "알 수 없는 오류가 발생했습니다.",
      };

      if (e instanceof StructError) {
        response = {
          success: false,
          error: `입력 데이터 오류: ${e.key} 필드가 올바르지 않습니다. ${e.message}`,
        };
        res.status(400).json(response);
      } else if (e instanceof Prisma.PrismaClientValidationError) {
        response = {
          success: false,
          error: `입력 데이터 오류: ${e.message}`,
        };
        res.status(400).json(response);
      } else if (e instanceof Prisma.PrismaClientKnownRequestError) {
        switch (e.code) {
          case "P2025":
            response = {
              success: false,
              error: "데이터 없음 오류: 요청한 데이터를 찾을 수 없습니다.",
            };
            res.status(404).json(response);
            break;
          case "P2002":
            response = {
              success: false,
              error: `중복된 데이터 오류: ${e.meta?.target || "알 수 없는 필드"}`,
            };
            res.status(409).json(response);
            break;
          default:
            response = {
              success: false,
              error: `데이터베이스 오류: ${e.message}`,
            };
            res.status(400).json(response);
        }
      } else if (e instanceof JsonWebTokenError) {
        response = {
          success: false,
          error: "인증 오류: 유효하지 않거나 만료된 토큰입니다.",
        };
        res.status(401).json(response);
      } else {
        response = {
          success: false,
          error: `알 수 없는 오류: ${e.message}`,
        };
        res.status(500).json(response);
      }
    }
  };
}
