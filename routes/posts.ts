import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prismaClient.js";
import { requiredAuthenticate, optionalAuthenticate, requireOwner } from "../middleware/auth.js";

const postsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /posts - 게시글 목록 조회
  const getPostsQuerySchema = z.object({
    offset: z.string().optional().default("0"),
    limit: z.string().optional().default("10"),
  });

  fastify.get(
    "/",
    { preHandler: optionalAuthenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = getPostsQuerySchema.parse(request.query);
      const { offset, limit } = query;

      const [totalCount, posts] = await Promise.all([
        prisma.post.count({ where: { is_deleted: false } }),
        prisma.post.findMany({
          where: { is_deleted: false },
          skip: parseInt(offset),
          take: parseInt(limit),
          orderBy: { created_at: "desc" },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
            category: true,
            tags: true,
          },
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          posts,
          totalCount,
        },
      });
    }
  );

  // GET /posts/:id - 단일 게시글 조회
  const getPostParamsSchema = z.object({
    id: z.string().uuid(),
  });

  fastify.get(
    "/:id",
    { preHandler: optionalAuthenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = getPostParamsSchema.parse(request.params);

      const post = await prisma.post.findFirst({
        where: {
          id,
          is_deleted: false,
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          category: true,
          tags: true,
        },
      });

      if (!post) {
        return reply.status(404).send({
          success: false,
          error: "게시글을 찾을 수 없습니다.",
        });
      }

      return reply.send({
        success: true,
        data: post,
      });
    }
  );

  // POST /posts - 게시글 생성 (OWNER만)
  const createPostBodySchema = z.object({
    title: z.string().min(1),
    content: z.string().min(1),
    excerpt: z.string().optional(),
    cover_image: z.string().url().optional(),
    published: z.boolean().default(false),
    category_id: z.string().uuid().optional(),
    tag_ids: z.array(z.string().uuid()).optional(),
  });

  fastify.post(
    "/",
    { preHandler: [requiredAuthenticate, requireOwner] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createPostBodySchema.parse(request.body);
      const { title, content, excerpt, cover_image, published, category_id, tag_ids } = body;
      const author_id = request.user!.id;

      // slug 생성
      const baseSlug = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9가-힣\s-]/g, "")
        .replace(/\s+/g, "-")
        .substring(0, 100);

      let slug = baseSlug;
      let counter = 1;
      while (await prisma.post.findFirst({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const post = await prisma.post.create({
        data: {
          title,
          slug,
          content,
          excerpt,
          cover_image,
          published,
          author_id: author_id!,
          category_id,
          published_at: published ? new Date() : null,
          ...(tag_ids &&
            tag_ids.length > 0 && {
              tags: {
                connect: tag_ids.map((id) => ({ id })),
              },
            }),
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          category: true,
          tags: true,
        },
      });

      return reply.status(201).send({
        success: true,
        data: post,
      });
    }
  );

  // PATCH /posts/:id - 게시글 수정 (OWNER만)
  const updatePostParamsSchema = z.object({
    id: z.string().uuid(),
  });

  const updatePostBodySchema = z.object({
    title: z.string().min(1).optional(),
    content: z.string().min(1).optional(),
    excerpt: z.string().optional(),
    cover_image: z.string().url().optional().nullable(),
    published: z.boolean().optional(),
    category_id: z.string().uuid().optional().nullable(),
    tag_ids: z.array(z.string().uuid()).optional(),
  });

  fastify.patch(
    "/:id",
    { preHandler: [requiredAuthenticate, requireOwner] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = updatePostParamsSchema.parse(request.params);
      const body = updatePostBodySchema.parse(request.body);

      const existingPost = await prisma.post.findUnique({
        where: { id },
      });

      if (!existingPost || existingPost.is_deleted) {
        return reply.status(404).send({
          success: false,
          error: "게시글을 찾을 수 없습니다.",
        });
      }

      const { title, content, excerpt, cover_image, published, category_id, tag_ids } = body;

      const post = await prisma.post.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(content !== undefined && { content }),
          ...(excerpt !== undefined && { excerpt }),
          ...(cover_image !== undefined && { cover_image }),
          ...(published !== undefined && { published }),
          ...(category_id !== undefined && { category_id }),
          ...(tag_ids !== undefined && {
            tags: {
              set: tag_ids.map((id) => ({ id })),
            },
          }),
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          category: true,
          tags: true,
        },
      });

      return reply.send({
        success: true,
        data: post,
      });
    }
  );

  // DELETE /posts/:id - 게시글 삭제 (OWNER만, soft delete)
  const deletePostParamsSchema = z.object({
    id: z.string().uuid(),
  });

  fastify.delete(
    "/:id",
    { preHandler: [requiredAuthenticate, requireOwner] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = deletePostParamsSchema.parse(request.params);

      const existingPost = await prisma.post.findUnique({
        where: { id },
      });

      if (!existingPost || existingPost.is_deleted) {
        return reply.status(404).send({
          success: false,
          error: "게시글을 찾을 수 없습니다.",
        });
      }

      await prisma.post.update({
        where: { id },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
        },
      });

      return reply.send({
        success: true,
        message: "게시글이 삭제되었습니다.",
      });
    }
  );
};

export default postsRoutes;
