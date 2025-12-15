import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prismaClient.js";
import { requireOwner } from "../middleware/auth.js";

const createSlug = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 50);

const tagsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /tags - 태그 목록 조회
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const tags = await prisma.tag.findMany({
      where: { is_deleted: false },
      orderBy: { post_count: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        post_count: true,
        created_at: true,
      },
    });

    return reply.send({
      success: true,
      data: tags,
    });
  });

  // POST /tags - 태그 생성 (OWNER만)
  const createTagBodySchema = z.object({
    name: z.string().min(1),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
  });

  fastify.post("/", { preHandler: requireOwner }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createTagBodySchema.parse(request.body);
    const { name, color } = body;

    // slug 생성
    const baseSlug = createSlug(name);
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.tag.findFirst({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const tag = await prisma.tag.create({
      data: {
        name,
        slug,
        color,
      },
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
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
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

      const { name, color } = body;

      // slug 재생성 (name 변경 시)
      let slug = existingTag.slug;
      if (name && name !== existingTag.name) {
        const baseSlug = createSlug(name);
        slug = baseSlug;
        let counter = 1;
        while (await prisma.tag.findFirst({ where: { slug, id: { not: id } } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
      }

      const tag = await prisma.tag.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(name && { slug }),
          ...(color !== undefined && { color }),
        },
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
