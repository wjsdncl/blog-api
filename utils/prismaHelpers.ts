/**
 * Prisma 공통 헬퍼
 *
 * - findByIdOrThrow / findBySlugOrThrow: 존재하지 않으면 NotFoundError
 * - incrementViewCount: 메모리 캐시 기반 24시간 IP 중복 방지
 * - addStatusFilter: OWNER는 전체 상태, 일반 사용자는 PUBLISHED만 조회
 */
import { prisma } from "@/lib/prismaClient.js";
import { NotFoundError, ConflictError, BadRequestError } from "@/lib/errors.js";


type PrismaModel = "post" | "comment" | "category" | "tag" | "portfolio" | "techStack" | "user" | "postLike" | "commentLike";

const ENTITY_NAMES: Record<PrismaModel, string> = {
  post: "게시글",
  comment: "댓글",
  category: "카테고리",
  tag: "태그",
  portfolio: "포트폴리오",
  techStack: "기술 스택",
  user: "사용자",
  postLike: "게시글 좋아요",
  commentLike: "댓글 좋아요",
};


/**
 * ID로 엔티티 조회, 없으면 NotFoundError 발생
 */
export async function findByIdOrThrow<T>(
  model: PrismaModel,
  id: string,
  select?: Record<string, unknown>
): Promise<T> {
  const prismaModel = prisma[model] as { findUnique: (args: unknown) => Promise<T | null> };

  const entity = await prismaModel.findUnique({
    where: { id },
    ...(select && { select }),
  });

  if (!entity) {
    throw new NotFoundError(ENTITY_NAMES[model]);
  }

  return entity;
}

/**
 * 슬러그로 엔티티 조회, 없으면 NotFoundError 발생
 */
export async function findBySlugOrThrow<T>(
  model: "post" | "category" | "tag" | "portfolio",
  slug: string,
  select?: Record<string, unknown>
): Promise<T> {
  const prismaModel = prisma[model] as { findUnique: (args: unknown) => Promise<T | null> };

  const entity = await prismaModel.findUnique({
    where: { slug },
    ...(select && { select }),
  });

  if (!entity) {
    throw new NotFoundError(ENTITY_NAMES[model]);
  }

  return entity;
}


/**
 * 유니크 필드 중복 체크
 */
export async function checkUniqueField(
  model: PrismaModel,
  field: "name" | "username" | "email" | "slug",
  value: string,
  excludeId?: string,
  customMessage?: string
): Promise<void> {
  const prismaModel = prisma[model] as { findUnique: (args: unknown) => Promise<{ id: string } | null> };

  const existing = await prismaModel.findUnique({
    where: { [field]: value },
    select: { id: true },
  });

  if (existing && (!excludeId || existing.id !== excludeId)) {
    const fieldNames: Record<string, string> = {
      name: "이름",
      username: "사용자명",
      email: "이메일",
      slug: "슬러그",
    };
    throw new ConflictError(customMessage || `이미 사용 중인 ${fieldNames[field]}입니다.`);
  }
}

/**
 * 이름 중복 체크 (카테고리, 태그, 기술스택 등)
 */
export async function checkUniqueName(
  model: "category" | "tag" | "techStack",
  name: string,
  excludeId?: string
): Promise<void> {
  const messages: Record<string, string> = {
    category: "이미 사용 중인 카테고리명입니다.",
    tag: "이미 사용 중인 태그명입니다.",
    techStack: "이미 사용 중인 기술 스택명입니다.",
  };

  await checkUniqueField(model, "name", name, excludeId, messages[model]);
}


// 조회수 중복 방지용 인메모리 캐시
// key: "model:entityId:ip", value: 만료 timestamp
// 서버 재시작 시 초기화되지만 조회수 정확도보다 성능을 우선
const VIEW_WINDOW_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const viewCache = new Map<string, number>();

let cleanupStarted = false;
function ensureCleanupInterval(): void {
  if (cleanupStarted) return;
  cleanupStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [key, expiresAt] of viewCache) {
      if (expiresAt <= now) viewCache.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * 조회수 증가 (OWNER 제외, 같은 IP는 24시간 내 중복 무시)
 */
export async function incrementViewCount(
  model: "post" | "portfolio",
  entityId: string,
  isOwner: boolean,
  ip?: string
): Promise<void> {
  if (isOwner) return;
  ensureCleanupInterval();

  const cacheKey = `${model}:${entityId}:${ip ?? "unknown"}`;
  const now = Date.now();

  if (viewCache.has(cacheKey) && viewCache.get(cacheKey)! > now) return;

  viewCache.set(cacheKey, now + VIEW_WINDOW_MS);

  const prismaModel = prisma[model] as { update: (args: unknown) => Promise<unknown> };

  await prismaModel.update({
    where: { id: entityId },
    data: { view_count: { increment: 1 } },
  });
}


/**
 * 공개 콘텐츠 접근 권한 체크
 * 비공개/예약 발행 콘텐츠는 OWNER만 접근 가능
 */
export function assertPublicAccess(
  entity: { status: string; published_at?: Date | null },
  isOwner: boolean,
  entityName: string = "콘텐츠"
): void {
  if (entity.status !== "PUBLISHED" && !isOwner) {
    throw new NotFoundError(entityName);
  }

  // 예약 발행 체크 (발행일이 미래인 경우)
  if (
    entity.status === "PUBLISHED" &&
    entity.published_at &&
    entity.published_at > new Date() &&
    !isOwner
  ) {
    throw new NotFoundError(entityName);
  }
}


/**
 * 상태 필터 조건 생성 (순수 함수)
 * OWNER는 모든 상태 조회 가능, 일반 사용자는 PUBLISHED만
 */
export function buildStatusFilter(
  isOwner: boolean,
  requestedStatus?: string
): Record<string, unknown> {
  if (isOwner && requestedStatus) {
    return { status: requestedStatus };
  }
  if (!isOwner) {
    return {
      status: "PUBLISHED",
      OR: [
        { published_at: null },
        { published_at: { lte: new Date() } },
      ],
    };
  }
  return {};
}


/**
 * 카테고리 ID 존재 검증
 */
export async function validateCategoryId(categoryId: string | null | undefined): Promise<void> {
  if (!categoryId) return;
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) {
    throw new BadRequestError("존재하지 않는 카테고리입니다.");
  }
}


/**
 * 발행일 계산
 * PUBLISHED 상태로 변경 시 발행일 자동 설정
 */
export function calculatePublishedAt(
  newStatus: string | undefined,
  providedDate: Date | undefined,
  previousStatus?: string
): Date | undefined {
  if (newStatus === "PUBLISHED" && !providedDate && newStatus !== previousStatus) {
    return new Date();
  }
  return providedDate;
}
