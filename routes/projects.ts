import { FastifyPluginAsync } from "fastify";

const projectsRoutes: FastifyPluginAsync = async (fastify) => {
  // Projects 기능은 나중에 구현
  fastify.get("/", async (request, reply) => {
    return reply.send({ success: true, data: [], message: "Projects feature coming soon" });
  });
};

export default projectsRoutes;
