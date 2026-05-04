/**
 * 업로드 서비스
 *
 * Supabase Storage의 이미지 목록 조회/캐시 관리, 이미지 업로드 처리.
 */
import { supabase } from "@/lib/supabase.js";
import { BadRequestError } from "@/lib/errors.js";
import { processImage } from "@/utils/imageOptimizer.js";

const BUCKET_NAME = "images";
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const IMAGE_MIME_PREFIXES = ["image/"];
const STORAGE_FOLDERS = ["", "posts"];
const STORAGE_LIST_LIMIT = 500;
const CACHE_TTL_MS = 30_000;

export const STORAGE_PAGE_SIZE = 20;

export interface StorageImage {
  name: string;
  url: string;
  size: number;
  createdAt: string;
}

let imageCache: { data: StorageImage[]; expiresAt: number } | null = null;

export function invalidateImageCache(): void {
  imageCache = null;
}

export async function fetchAllStorageImages(): Promise<StorageImage[]> {
  if (imageCache && Date.now() < imageCache.expiresAt) {
    return imageCache.data;
  }

  const allImages: StorageImage[] = [];

  for (const folder of STORAGE_FOLDERS) {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(folder || undefined, {
        limit: STORAGE_LIST_LIMIT,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error || !data) continue;

    for (const file of data) {
      const mimetype = file.metadata?.mimetype as string | undefined;
      if (!mimetype) continue;
      if (!IMAGE_MIME_PREFIXES.some((prefix) => mimetype.startsWith(prefix))) continue;

      const filePath = folder ? `${folder}/${file.name}` : file.name;
      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      allImages.push({
        name: filePath,
        url: publicUrlData.publicUrl,
        size: file.metadata.size as number,
        createdAt: file.created_at,
      });
    }
  }

  allImages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  imageCache = { data: allImages, expiresAt: Date.now() + CACHE_TTL_MS };
  return allImages;
}

export interface UploadImageInput {
  buffer: Buffer;
  mimetype: string;
  filename: string;
}

export async function uploadImage({ buffer: originalBuffer, mimetype, filename }: UploadImageInput): Promise<string> {
  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    throw new BadRequestError("지원되지 않는 이미지 형식입니다. (JPEG, PNG, GIF, WEBP만 허용)");
  }

  if (originalBuffer.length > MAX_FILE_SIZE) {
    throw new BadRequestError("파일 크기가 10MB를 초과합니다.");
  }

  const { buffer, contentType, filePath } = await processImage(originalBuffer, mimetype, filename);

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new BadRequestError(`파일 업로드에 실패했습니다: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  invalidateImageCache();
  return publicUrlData.publicUrl;
}
