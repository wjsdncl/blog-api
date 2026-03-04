/**
 * Upload Routes
 * 이미지 업로드 (Supabase Storage)
 */
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { requiredAuthenticate } from "@/middleware/auth.js";
import { BadRequestError } from "@/lib/errors.js";
import { supabase } from "@/lib/supabase.js";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BUCKET_NAME = "images";

const uploadRoutes: FastifyPluginAsync = async (fastify) => {
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

    const buffer = await file.toBuffer();
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestError("파일 크기가 10MB를 초과합니다.");
    }

    const uuid = crypto.randomUUID().slice(0, 8);
    const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `posts/${uuid}-${safeName}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.mimetype,
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
