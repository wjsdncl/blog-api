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

const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /categories - 카테고리 목록 조회
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const categories = await prisma.category.findMany({
      where: { is_deleted: false },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        icon: true,
        order: true,
        post_count: true,
        created_at: true,
      },
    });

    return reply.send({
      success: true,
      data: categories,
    });
  });

  // POST /categories - 카테고리 생성 (OWNER만)
  const createCategoryBodySchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    icon: z.string().optional(),
    order: z.number().int().optional().default(0),
  });

  fastify.post("/", { preHandler: requireOwner }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createCategoryBodySchema.parse(request.body);
    const { name, description, color, icon, order } = body;

    // slug 생성
    const baseSlug = createSlug(name);
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.category.findFirst({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        color,
        icon,
        order,
      },
    });

    return reply.status(201).send({
      success: true,
      data: category,
    });
  });

  // PATCH /categories/:id - 카테고리 수정 (OWNER만)
  const updateCategoryParamsSchema = z.object({
    id: z.string().uuid(),
  });

  const updateCategoryBodySchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    icon: z.string().optional(),
    order: z.number().int().optional(),
  });

  fastify.patch(
    "/:id",
    { preHandler: requireOwner },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = updateCategoryParamsSchema.parse(request.params);
      const body = updateCategoryBodySchema.parse(request.body);

      const existingCategory = await prisma.category.findUnique({
        where: { id },
      });

      if (!existingCategory || existingCategory.is_deleted) {
        return reply.status(404).send({
          success: false,
          error: "카테고리를 찾을 수 없습니다.",
        });
      }

      const { name, description, color, icon, order } = body;

      // slug 재생성 (name 변경 시)
      let slug = existingCategory.slug;
      if (name && name !== existingCategory.name) {
        const baseSlug = createSlug(name);
        slug = baseSlug;
        let counter = 1;
        while (await prisma.category.findFirst({ where: { slug, id: { not: id } } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
      }

      const category = await prisma.category.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(name && { slug }),
          ...(description !== undefined && { description }),
          ...(color !== undefined && { color }),
          ...(icon !== undefined && { icon }),
          ...(order !== undefined && { order }),
        },
      });

      return reply.send({
        success: true,
        data: category,
      });
    }
  );

  // DELETE /categories/:id - 카테고리 삭제 (OWNER만, soft delete)
  const deleteCategoryParamsSchema = z.object({
    id: z.string().uuid(),
  });

  fastify.delete(
    "/:id",
    { preHandler: requireOwner },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = deleteCategoryParamsSchema.parse(request.params);

      const existingCategory = await prisma.category.findUnique({
        where: { id },
      });

      if (!existingCategory || existingCategory.is_deleted) {
        return reply.status(404).send({
          success: false,
          error: "카테고리를 찾을 수 없습니다.",
        });
      }

      await prisma.category.update({
        where: { id },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
        },
      });

      return reply.send({
        success: true,
        message: "카테고리가 삭제되었습니다.",
      });
    }
  );
};

export default categoriesRoutes;
