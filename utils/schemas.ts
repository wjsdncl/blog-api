/**
 * Common Zod Schemas
 * 공통 Zod 스키마
 */
import { z } from "zod";

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

export const slugParamsSchema = z.object({
  slug: z.string().min(1, "슬러그는 필수입니다."),
});
