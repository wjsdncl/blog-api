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
  fastify.post("/", { preHandler: requiredAuthenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const file = await request.file();
    if (!file) throw new BadRequestError("파일이 첨부되지 않았습니다.");

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestError("지원되지 않는 이미지 형식입니다. (JPEG, PNG, GIF, WEBP만 허용)");
    }

    const buffer = await file.toBuffer();
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestError("파일 크기가 10MB를 초과합니다.");
    }

    const timestamp = Date.now();
    const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `posts/${timestamp}-${safeName}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.mimetype,
        upsert: true,
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
