/**
 * Upload Routes
 * 이미지 업로드 (Supabase Storage)
 */
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { requiredAuthenticate, requireOwner } from "@/middleware/auth.js";
import { BadRequestError } from "@/lib/errors.js";
import {
  STORAGE_PAGE_SIZE,
  fetchAllStorageImages,
  uploadImage,
} from "@/services/upload.service.js";

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

    const url = await uploadImage({
      buffer: await file.toBuffer(),
      mimetype: file.mimetype,
      filename: file.filename,
    });

    return reply.send({ success: true, url });
  });
};

export default uploadRoutes;
