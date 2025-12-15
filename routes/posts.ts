import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prismaClient.js";
import { requiredAuthenticate, optionalAuthenticate, requireOwner } from "../middleware/auth.js";
import type { Prisma, PrismaClient } from "@prisma/client";

const postsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /posts - 게시글 목록 조회
  const getPostsQuerySchema = z.object({
    offset: z.string().optional().default("0"),
    limit: z.string().optional().default("10"),
    order: z.enum(["newest", "oldest", "popular"]).optional().default("newest"),
    category: z.string().optional(),
    tag: z.string().optional(),
    search: z.string().optional(),
    published: z.enum(["true", "false", "all"]).optional().default("true"),
  });

  fastify.get(
    "/",
    { preHandler: optionalAuthenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = getPostsQuerySchema.parse(request.query);
      const {
        offset,
        limit,
        order,
        category: categorySlug,
        tag: tagSlug,
        search,
        published: publishedFilter,
      } = query;

      const isOwner = request.user?.role === "OWNER";

      // 정렬 조건
      let orderBy: Prisma.PostOrderByWithRelationInput;
      switch (order) {
        case "oldest":
          orderBy = { created_at: "asc" };
          break;
        case "popular":
          orderBy = { like_count: "desc" };
          break;
        case "newest":
        default:
          orderBy = { created_at: "desc" };
      }

      // WHERE 조건
      const where: Prisma.PostWhereInput = {
        is_deleted: false,
        ...(categorySlug && { category: { slug: categorySlug } }),
        ...(tagSlug && { tags: { some: { slug: tagSlug } } }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { content: { contains: search, mode: "insensitive" } },
            { excerpt: { contains: search, mode: "insensitive" } },
          ],
        }),
      };

      // 공개 상태 필터 (OWNER가 아니면 항상 published만)
      if (!isOwner || publishedFilter === "true") {
        where.published = true;
      } else if (publishedFilter === "false") {
        where.published = false;
      }

      const [totalCount, posts, categories] = await Promise.all([
        prisma.post.count({ where }),
        prisma.post.findMany({
          where,
          skip: parseInt(offset),
          take: parseInt(limit),
          orderBy,
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            cover_image: true,
            published: true,
            featured: true,
            view_count: true,
            like_count: true,
            comment_count: true,
            author_id: true,
            category_id: true,
            published_at: true,
            created_at: true,
            updated_at: true,
            author: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
            tags: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
            post_likes: request.user?.id
              ? {
                  where: { user_id: request.user.id },
                  select: { id: true },
                }
              : false,
          },
        }),
        prisma.category.findMany({
          where: { is_deleted: false },
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            post_count: true,
          },
          orderBy: { order: "asc" },
        }),
      ]);

      const postsWithLikes = posts.map((post: any) => ({
        ...post,
        isLiked: Array.isArray(post.post_likes) && post.post_likes.length > 0,
        post_likes: undefined,
      }));

      return reply.send({
        success: true,
        data: {
          posts: postsWithLikes,
          totalCount,
          categories,
        },
      });
    }
  );

  // GET /posts/:slug - 단일 게시글 조회
  const getPostParamsSchema = z.object({
    slug: z.string(),
  });

  fastify.get(
    "/:slug",
    { preHandler: optionalAuthenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { slug } = getPostParamsSchema.parse(request.params);
      const isOwner = request.user?.role === "OWNER";

      const post = await prisma.post.findFirst({
        where: {
          slug,
          is_deleted: false,
          ...(!isOwner && { published: true }),
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              color: true,
              icon: true,
            },
          },
          tags: {
            select: {
              id: true,
              name: true,
              slug: true,
              color: true,
            },
          },
          post_likes: request.user?.id
            ? {
                where: { user_id: request.user.id },
                select: { id: true },
              }
            : false,
        },
      });

      if (!post) {
        return reply.status(404).send({
          success: false,
          error: "게시글을 찾을 수 없습니다.",
        });
      }

      // 조회수 증가
      await prisma.post.update({
        where: { id: post.id },
        data: { view_count: { increment: 1 } },
      });

      const postWithLike = {
        ...post,
        isLiked: Array.isArray(post.post_likes) && post.post_likes.length > 0,
        post_likes: undefined,
      };

      return reply.send({
        success: true,
        data: postWithLike,
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
    featured: z.boolean().default(false),
    category_id: z.string().uuid().optional(),
    tag_ids: z.array(z.string().uuid()).optional(),
  });

  fastify.post(
    "/",
    { preHandler: [requiredAuthenticate, requireOwner] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createPostBodySchema.parse(request.body);
      const { title, content, excerpt, cover_image, published, featured, category_id, tag_ids } = body;
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
          featured,
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

      // 카테고리 post_count 증가
      if (category_id) {
        await prisma.category.update({
          where: { id: category_id },
          data: { post_count: { increment: 1 } },
        });
      }

      // 태그 post_count 증가
      if (tag_ids && tag_ids.length > 0) {
        await prisma.tag.updateMany({
          where: { id: { in: tag_ids } },
          data: { post_count: { increment: 1 } },
        });
      }

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
    featured: z.boolean().optional(),
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
        include: { tags: true },
      });

      if (!existingPost || existingPost.is_deleted) {
        return reply.status(404).send({
          success: false,
          error: "게시글을 찾을 수 없습니다.",
        });
      }

      const { title, content, excerpt, cover_image, published, featured, category_id, tag_ids } = body;

      // slug 재생성 (title 변경 시)
      let slug = existingPost.slug;
      if (title && title !== existingPost.title) {
        const baseSlug = title
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9가-힣\s-]/g, "")
          .replace(/\s+/g, "-")
          .substring(0, 100);

        slug = baseSlug;
        let counter = 1;
        while (await prisma.post.findFirst({ where: { slug, id: { not: id } } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
      }

      // 카테고리 변경 처리
      const oldCategoryId = existingPost.category_id;
      const newCategoryId = category_id !== undefined ? category_id : oldCategoryId;

      if (oldCategoryId !== newCategoryId) {
        if (oldCategoryId) {
          await prisma.category.update({
            where: { id: oldCategoryId },
            data: { post_count: { decrement: 1 } },
          });
        }
        if (newCategoryId) {
          await prisma.category.update({
            where: { id: newCategoryId },
            data: { post_count: { increment: 1 } },
          });
        }
      }

      // 태그 변경 처리
      if (tag_ids !== undefined) {
        const oldTagIds = existingPost.tags.map((t: any) => t.id);
        const removedTags = oldTagIds.filter((id: string) => !tag_ids.includes(id));
        const addedTags = tag_ids.filter((id) => !oldTagIds.includes(id));

        if (removedTags.length > 0) {
          await prisma.tag.updateMany({
            where: { id: { in: removedTags } },
            data: { post_count: { decrement: 1 } },
          });
        }

        if (addedTags.length > 0) {
          await prisma.tag.updateMany({
            where: { id: { in: addedTags } },
            data: { post_count: { increment: 1 } },
          });
        }
      }

      const post = await prisma.post.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(title && { slug }),
          ...(content !== undefined && { content }),
          ...(excerpt !== undefined && { excerpt }),
          ...(cover_image !== undefined && { cover_image }),
          ...(published !== undefined && {
            published,
            published_at: published && !existingPost.published ? new Date() : existingPost.published_at,
          }),
          ...(featured !== undefined && { featured }),
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
        include: { tags: true },
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

      // 카테고리 post_count 감소
      if (existingPost.category_id) {
        await prisma.category.update({
          where: { id: existingPost.category_id },
          data: { post_count: { decrement: 1 } },
        });
      }

      // 태그 post_count 감소
      if (existingPost.tags.length > 0) {
        await prisma.tag.updateMany({
          where: { id: { in: existingPost.tags.map((t: any) => t.id) } },
          data: { post_count: { decrement: 1 } },
        });
      }

      return reply.send({
        success: true,
        message: "게시글이 삭제되었습니다.",
      });
    }
  );

  // POST /posts/:id/like - 좋아요 토글
  const likePostParamsSchema = z.object({
    id: z.string().uuid(),
  });

  fastify.post(
    "/:id/like",
    { preHandler: requiredAuthenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: postId } = likePostParamsSchema.parse(request.params);
      const userId = request.user!.id!;

      const result = await prisma.$transaction(async (tx) => {
        const existingLike = await tx.postLike.findUnique({
          where: {
            user_id_post_id: { user_id: userId, post_id: postId },
          },
        });

        let liked: boolean;
        let updatedPost;

        if (existingLike) {
          // 좋아요 취소
          await tx.postLike.delete({
            where: {
              user_id_post_id: { user_id: userId, post_id: postId },
            },
          });

          updatedPost = await tx.post.update({
            where: { id: postId },
            data: { like_count: { decrement: 1 } },
            select: { like_count: true },
          });

          liked = false;
        } else {
          // 좋아요 추가
          await tx.postLike.create({
            data: {
              user_id: userId,
              post_id: postId,
            },
          });

          updatedPost = await tx.post.update({
            where: { id: postId },
            data: { like_count: { increment: 1 } },
            select: { like_count: true },
          });

          liked = true;
        }

        return { liked, likeCount: updatedPost.like_count };
      });

      return reply.send({
        success: true,
        data: result,
      });
    }
  );
};

export default postsRoutes;
