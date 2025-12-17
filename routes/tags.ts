import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prismaClient.js";
import { requireOwner } from "../middleware/auth.js";

const tagsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /tags - 태그 목록 조회
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const tags = await prisma.tag.findMany({
      where: { is_deleted: false },
      orderBy: { name: "asc" },
    });

    return reply.send({
      success: true,
      data: tags,
    });
  });

  // POST /tags - 태그 생성 (OWNER만)
  const createTagBodySchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    color: z.string().optional(),
  });

  fastify.post("/", { preHandler: requireOwner }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createTagBodySchema.parse(request.body);

    const tag = await prisma.tag.create({
      data: body,
    });

    return reply.status(201).send({
      success: true,
      data: tag,
    });
  });

  // PATCH /tags/:id - 태그 수정 (OWNER만)
  const updateTagParamsSchema = z.object({
    id: z.string().uuid(),
  });

  const updateTagBodySchema = z.object({
    name: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    color: z.string().optional(),
  });

  fastify.patch(
    "/:id",
    { preHandler: requireOwner },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = updateTagParamsSchema.parse(request.params);
      const body = updateTagBodySchema.parse(request.body);

      const existingTag = await prisma.tag.findUnique({
        where: { id },
      });

      if (!existingTag || existingTag.is_deleted) {
        return reply.status(404).send({
          success: false,
          error: "태그를 찾을 수 없습니다.",
        });
      }

      const tag = await prisma.tag.update({
        where: { id },
        data: body,
      });

      return reply.send({
        success: true,
        data: tag,
      });
    }
  );

  // DELETE /tags/:id - 태그 삭제 (OWNER만, soft delete)
  const deleteTagParamsSchema = z.object({
    id: z.string().uuid(),
  });

  fastify.delete(
    "/:id",
    { preHandler: requireOwner },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = deleteTagParamsSchema.parse(request.params);

      const existingTag = await prisma.tag.findUnique({
        where: { id },
      });

      if (!existingTag || existingTag.is_deleted) {
        return reply.status(404).send({
          success: false,
          error: "태그를 찾을 수 없습니다.",
        });
      }

      await prisma.tag.update({
        where: { id },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
        },
      });

      return reply.send({
        success: true,
        message: "태그가 삭제되었습니다.",
      });
    }
  );
};

export default tagsRoutes;
