/**
 * Upload Routes
 * 이미지 업로드 (Supabase Storage)
 */
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { requiredAuthenticate, requireOwner } from "@/middleware/auth.js";
import { BadRequestError } from "@/lib/errors.js";
import { supabase } from "@/lib/supabase.js";
import { processImage } from "@/utils/imageOptimizer.js";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BUCKET_NAME = "images";

const IMAGE_MIME_PREFIXES = ["image/"];
const STORAGE_FOLDERS = ["", "posts"];

const STORAGE_PAGE_SIZE = 20;

// 모든 Storage 이미지를 한 번에 조회하여 캐시
async function fetchAllStorageImages(): Promise<Array<{ name: string; url: string; size: number; createdAt: string }>> {
  const allImages: Array<{ name: string; url: string; size: number; createdAt: string }> = [];

  for (const folder of STORAGE_FOLDERS) {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(folder || undefined, {
        limit: 500,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error || !data) continue;

    for (const file of data) {
      if (!file.metadata?.mimetype) continue;
      const isImage = IMAGE_MIME_PREFIXES.some((prefix) =>
        (file.metadata.mimetype as string).startsWith(prefix)
      );
      if (!isImage) continue;

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
  return allImages;
}

const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /storage - Storage 이미지 목록 조회 (페이지네이션)
  fastify.get<{ Querystring: { page?: string } }>("/storage", {
    schema: {
      tags: ["Upload"],
      summary: "Storage 이미지 목록 조회",
      description: "Supabase Storage에 저장된 이미지 목록을 페이지네이션으로 반환합니다.",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          page: { type: "string", description: "페이지 번호 (기본: 1)" },
        },
      },
      response: {
        200: {
          description: "조회 성공",
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  url: { type: "string", format: "uri" },
                  size: { type: "number" },
                  createdAt: { type: "string" },
                },
              },
            },
            hasNext: { type: "boolean" },
            nextPage: { type: "number" },
            total: { type: "number" },
          },
        },
        401: { $ref: "ErrorResponse" },
        403: { $ref: "ErrorResponse" },
      },
    },
    preHandler: requireOwner,
  }, async (request, reply) => {
    const page = Math.max(1, parseInt(request.query.page || "1", 10));
    const allImages = await fetchAllStorageImages();

    const start = (page - 1) * STORAGE_PAGE_SIZE;
    const pageData = allImages.slice(start, start + STORAGE_PAGE_SIZE);
    const hasNext = start + STORAGE_PAGE_SIZE < allImages.length;

    return reply.send({
      success: true,
      data: pageData,
      hasNext,
      nextPage: hasNext ? page + 1 : null,
      total: allImages.length,
    });
  });

  // POST / - 이미지 업로드
  fastify.post("/", {
    schema: {
      tags: ["Upload"],
      summary: "이미지 업로드",
      description: "이미지를 Supabase Storage에 업로드합니다. (JPEG, PNG, GIF, WEBP, 최대 10MB)",
      security: [{ bearerAuth: [] }],
      consumes: ["multipart/form-data"],
      response: {
        200: {
          description: "업로드 성공",
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            url: { type: "string", format: "uri", description: "업로드된 이미지의 공개 URL" },
          },
        },
        400: { $ref: "ErrorResponse" },
        401: { $ref: "ErrorResponse" },
      },
    },
    preHandler: requiredAuthenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const file = await request.file();
    if (!file) throw new BadRequestError("파일이 첨부되지 않았습니다.");

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestError("지원되지 않는 이미지 형식입니다. (JPEG, PNG, GIF, WEBP만 허용)");
    }

    const originalBuffer = await file.toBuffer();
    if (originalBuffer.length > MAX_FILE_SIZE) {
      throw new BadRequestError("파일 크기가 10MB를 초과합니다.");
    }

    const { buffer, contentType, filePath } = await processImage(
      originalBuffer,
      file.mimetype,
      file.filename,
    );

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

    return reply.send({
      success: true,
      url: publicUrlData.publicUrl,
    });
  });
};

export default uploadRoutes;
