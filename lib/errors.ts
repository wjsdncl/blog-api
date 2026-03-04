/**
 * Custom Error Classes
 * 가이드라인: .agent-guidelines/backend-rules.md 참조
 */

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource}을(를) 찾을 수 없습니다.`, "NOT_FOUND");
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, message, "BAD_REQUEST");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "로그인이 필요합니다.") {
    super(401, message, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "접근 권한이 없습니다.") {
    super(403, message, "FORBIDDEN");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, "CONFLICT");
  }
}