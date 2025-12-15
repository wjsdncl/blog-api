import { FastifyPluginAsync } from "fastify";

const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  // Upload 기능은 나중에 구현
  fastify.post("/", async (request, reply) => {
    return reply.status(501).send({ success: false, message: "Upload feature coming soon" });
  });
};

export default uploadRoutes;
