import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prismaClient.js";
import { optionalAuthenticate } from "../middleware/auth.js";

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /users/:id - 사용자 프로필 조회
  const getUserParamsSchema = z.object({
    id: z.string().uuid(),
  });

  fastify.get(
    "/:id",
    { preHandler: optionalAuthenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = getUserParamsSchema.parse(request.params);

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          email: request.user?.id === id || request.user?.role === "OWNER",
          role: true,
          created_at: true,
        },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: "사용자를 찾을 수 없습니다.",
        });
      }

      return reply.send({
        success: true,
        data: user,
      });
    }
  );
};

export default usersRoutes;
