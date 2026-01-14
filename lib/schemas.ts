/**
 * Zod Validation Schemas
 * Prisma 스키마와 일치하도록 설계
 * 가이드라인: .agent-guidelines/backend-rules.md 참조
 */
import { z } from "zod";

// ============================================
// 공통 스키마
// ============================================

export const uuidSchema = z.string().uuid("유효하지 않은 ID 형식입니다.");

export const slugSchema = z
  .string()
  .min(1, "슬러그는 필수입니다.")
  .max(200, "슬러그는 200자 이하여야 합니다.")
  .regex(/^[a-z0-9가-힣-]+$/, "슬러그는 소문자, 숫자, 한글, 하이픈만 허용됩니다.");

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type Pagination = z.infer<typeof paginationSchema>;

// ============================================
// 인증 스키마
// ============================================

export const registerSchema = z.object({
  email: z.string().email("유효한 이메일을 입력해주세요."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
  username: z
    .string()
    .min(2, "사용자명은 2자 이상이어야 합니다.")
    .max(20, "사용자명은 20자 이하여야 합니다."),
});

export const loginSchema = z.object({
  email: z.string().email("유효한 이메일을 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ============================================
// 사용자 스키마
// ============================================

export const updateUserSchema = z.object({
  username: z
    .string()
    .min(2, "사용자명은 2자 이상이어야 합니다.")
    .max(20, "사용자명은 20자 이하여야 합니다.")
    .optional(),
  email: z.string().email("유효한 이메일을 입력해주세요.").optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ============================================
// 게시글 스키마
// ============================================

export const publishStatusSchema = z.enum(["DRAFT", "PUBLISHED", "SCHEDULED"]);

export const createPostSchema = z.object({
  title: z
    .string()
    .min(1, "제목은 필수입니다.")
    .max(200, "제목은 200자 이하여야 합니다."),
  content: z.string().min(10, "내용은 10자 이상이어야 합니다."),
  excerpt: z.string().max(500, "요약은 500자 이하여야 합니다.").optional(),
  cover_image: z.string().url("유효한 이미지 URL을 입력해주세요.").optional(),
  status: publishStatusSchema.default("DRAFT"),
  category_id: uuidSchema.optional(),
  tag_ids: z.array(uuidSchema).max(10, "태그는 최대 10개까지 가능합니다.").optional(),
});

export const updatePostSchema = createPostSchema.partial();

export const postQuerySchema = paginationSchema.extend({
  status: publishStatusSchema.optional(),
  category_id: uuidSchema.optional(),
  tag: z.string().optional(),
  search: z.string().max(100, "검색어는 100자 이하여야 합니다.").optional(),
  order: z.enum(["newest", "oldest", "popular"]).default("newest"),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type PostQuery = z.infer<typeof postQuerySchema>;

// ============================================
// 댓글 스키마
// ============================================

export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, "댓글 내용은 필수입니다.")
    .max(1000, "댓글은 1000자 이하여야 합니다."),
  post_id: uuidSchema,
  parent_id: uuidSchema.optional(),
});

export const updateCommentSchema = z.object({
  content: z
    .string()
    .min(1, "댓글 내용은 필수입니다.")
    .max(1000, "댓글은 1000자 이하여야 합니다."),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

// ============================================
// 카테고리 스키마
// ============================================

export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, "카테고리명은 필수입니다.")
    .max(50, "카테고리명은 50자 이하여야 합니다."),
  slug: slugSchema,
  description: z.string().max(200, "설명은 200자 이하여야 합니다.").optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "유효한 HEX 색상 코드를 입력해주세요.")
    .optional(),
  icon: z.string().max(50).optional(),
  order: z.number().int().min(0).default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ============================================
// 태그 스키마
// ============================================

export const createTagSchema = z.object({
  name: z
    .string()
    .min(1, "태그명은 필수입니다.")
    .max(30, "태그명은 30자 이하여야 합니다."),
  slug: slugSchema,
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "유효한 HEX 색상 코드를 입력해주세요.")
    .optional(),
});

export const updateTagSchema = createTagSchema.partial();

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;

// ============================================
// 포트폴리오 스키마
// ============================================

export const createPortfolioSchema = z.object({
  title: z
    .string()
    .min(1, "프로젝트 제목은 필수입니다.")
    .max(200, "제목은 200자 이하여야 합니다."),
  slug: slugSchema,
  content: z.string().min(10, "내용은 10자 이상이어야 합니다."),
  description: z.string().max(500, "설명은 500자 이하여야 합니다.").optional(),
  thumbnail: z.string().url("유효한 이미지 URL을 입력해주세요.").optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  status: publishStatusSchema.default("DRAFT"),
  order: z.number().int().min(0).default(0),
  category_id: uuidSchema.optional(),
  tag_ids: z.array(uuidSchema).max(10, "태그는 최대 10개까지 가능합니다.").optional(),
  tech_stack_ids: z.array(uuidSchema).optional(),
  links: z
    .array(
      z.object({
        type: z.string().min(1).max(20),
        url: z.string().url("유효한 URL을 입력해주세요."),
        label: z.string().max(50).optional(),
        order: z.number().int().min(0).default(0),
      })
    )
    .optional(),
});

export const updatePortfolioSchema = createPortfolioSchema.partial();

export type CreatePortfolioInput = z.infer<typeof createPortfolioSchema>;
export type UpdatePortfolioInput = z.infer<typeof updatePortfolioSchema>;

// ============================================
// 기술 스택 스키마
// ============================================

export const createTechStackSchema = z.object({
  name: z
    .string()
    .min(1, "기술명은 필수입니다.")
    .max(50, "기술명은 50자 이하여야 합니다."),
  category: z.string().max(30, "카테고리는 30자 이하여야 합니다.").optional(),
});

export const updateTechStackSchema = createTechStackSchema.partial();

export type CreateTechStackInput = z.infer<typeof createTechStackSchema>;
export type UpdateTechStackInput = z.infer<typeof updateTechStackSchema>;

// ============================================
// 좋아요 스키마
// ============================================

export const likePostSchema = z.object({
  post_id: uuidSchema,
});

export const likeCommentSchema = z.object({
  comment_id: uuidSchema,
});

export type LikePostInput = z.infer<typeof likePostSchema>;
export type LikeCommentInput = z.infer<typeof likeCommentSchema>;

// ============================================
// 공통 파라미터 스키마
// ============================================

export const idParamSchema = z.object({
  id: uuidSchema,
});

export const slugParamSchema = z.object({
  slug: z.string().min(1),
});

export type IdParam = z.infer<typeof idParamSchema>;
export type SlugParam = z.infer<typeof slugParamSchema>;
