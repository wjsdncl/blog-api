/**
 * Common Zod Schemas
 * 공통 Zod 스키마
 */
import { z } from "zod";

// ============================================
// ID Parameter Schemas
// ============================================

/**
 * UUID ID 파라미터 스키마 생성
 */
export function createIdParamsSchema(entityName: string) {
  return z.object({
    id: z.string().uuid(`유효하지 않은 ${entityName} ID입니다.`),
  });
}

// 미리 정의된 ID 스키마들
export const postIdParamsSchema = createIdParamsSchema("게시글");
export const commentIdParamsSchema = createIdParamsSchema("댓글");
export const categoryIdParamsSchema = createIdParamsSchema("카테고리");
export const tagIdParamsSchema = createIdParamsSchema("태그");
export const portfolioIdParamsSchema = createIdParamsSchema("포트폴리오");
export const techStackIdParamsSchema = createIdParamsSchema("기술 스택");
export const userIdParamsSchema = createIdParamsSchema("사용자");

// ============================================
// Slug Parameter Schema
// ============================================

export const slugParamsSchema = z.object({
  slug: z.string().min(1, "슬러그는 필수입니다."),
});

// ============================================
// Pagination Schemas
// ============================================

/**
 * 페이지네이션 기본 스키마
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/**
 * 커스텀 페이지네이션 스키마 생성
 */
export function createPaginationSchema(options: { maxLimit?: number; defaultLimit?: number } = {}) {
  const { maxLimit = 50, defaultLimit = 10 } = options;
  return z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(maxLimit).default(defaultLimit),
  });
}

// ============================================
// Common Field Schemas
// ============================================

/**
 * 상태 필터 스키마
 */
export const statusFilterSchema = z.enum(["DRAFT", "PUBLISHED", "SCHEDULED"]).optional();

/**
 * HEX 색상 코드 스키마
 */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "유효한 HEX 색상 코드를 입력해주세요.")
  .optional();

/**
 * URL 스키마
 */
export const urlSchema = z.string().url("유효한 URL을 입력해주세요.");
