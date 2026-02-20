/**
 * Slug Utilities
 * 슬러그 생성 관련 유틸리티
 */
import { prisma } from "@/lib/prismaClient.js";

type SlugModel = "post" | "tag" | "portfolio";

/**
 * 텍스트에서 슬러그 생성
 * - 한글은 그대로 유지
 * - 공백/특수문자는 하이픈으로 변환
 * - 연속 하이픈 제거
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s가-힣-]/g, "") // 영문, 숫자, 한글, 공백, 하이픈만 유지
    .replace(/[\s_]+/g, "-") // 공백/밑줄을 하이픈으로
    .replace(/-+/g, "-") // 연속 하이픈 제거
    .replace(/^-|-$/g, ""); // 앞뒤 하이픈 제거
}

/**
 * 중복되지 않는 슬러그 생성
 * @param model - 대상 모델 (post, category, tag, portfolio)
 * @param text - 슬러그로 변환할 텍스트
 * @param excludeId - 제외할 ID (수정 시 자기 자신 제외)
 */
export async function generateUniqueSlug(
  model: SlugModel,
  text: string,
  excludeId?: string,
): Promise<string> {
  const baseSlug = generateSlug(text);
  let slug = baseSlug;
  let counter = 1;

  const findBySlug = async (slug: string): Promise<{ id: string } | null> => {
    switch (model) {
      case "post":
        return prisma.post.findUnique({ where: { slug }, select: { id: true } });
      case "tag":
        return prisma.tag.findUnique({ where: { slug }, select: { id: true } });
      case "portfolio":
        return prisma.portfolio.findUnique({ where: { slug }, select: { id: true } });
    }
  };

  while (true) {
    const existing = await findBySlug(slug);

    if (!existing || existing.id === excludeId) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}
