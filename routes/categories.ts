import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prismaClient.js";
import { requireOwner } from "../middleware/auth.js";

const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /categories - 카테고리 목록 조회
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const categories = await prisma.category.findMany({
      where: { is_deleted: false },
      orderBy: { order: "asc" },
    });

    return reply.send({
      success: true,
      data: categories,
    });
  });

  // POST /categories - 카테고리 생성 (OWNER만)
  const createCategoryBodySchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    color: z.string().optional(),
    icon: z.string().optional(),
    order: z.number().int().optional(),
  });

  fastify.post("/", { preHandler: requireOwner }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createCategoryBodySchema.parse(request.body);

    const category = await prisma.category.create({
      data: body,
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
    slug: z.string().min(1).optional(),
    color: z.string().optional(),
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

      const category = await prisma.category.update({
        where: { id },
        data: body,
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
