/**
 * Users Routes
 * 사용자 프로필 관리
 */
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@/lib/prismaClient.js";
import { requiredAuthenticate, optionalAuthenticate, requireOwner } from "@/middleware/auth.js";
import { NotFoundError, ConflictError, BadRequestError } from "@/lib/errors.js";
import { userIdParamsSchema } from "@/utils/schemas.js";
import { findByIdOrThrow, checkUniqueField } from "@/utils/prismaHelpers.js";
import { zodToJsonSchema } from "@/utils/zodToJsonSchema.js";

// ============================================
// Schemas
// ============================================

const updateProfileSchema = z.object({
  username: z
    .string()
    .min(2, "사용자명은 2자 이상이어야 합니다.")
    .max(30, "사용자명은 30자 이하여야 합니다.")
    .regex(/^[a-zA-Z0-9_가-힣]+$/, "사용자명은 영문, 숫자, 밑줄, 한글만 사용 가능합니다.")
    .optional(),
});

const userListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  role: z.enum(["USER", "OWNER"]).optional(),
  is_active: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

// ============================================
// Select Objects
// ============================================

// 공개 프로필 (다른 사용자가 볼 수 있는 정보)
const publicProfileSelect = {
  id: true,
  username: true,
  role: true,
  created_at: true,
} as const;

// 본인 프로필 (자신만 볼 수 있는 정보 포함)
const privateProfileSelect = {
  ...publicProfileSelect,
  email: true,
} as const;

// 관리자용 사용자 목록
const adminUserListSelect = {
  id: true,
  username: true,
  email: true,
  role: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} as const;

// ============================================
// Routes
// ============================================

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /users
   * 사용자 목록 조회 (관리자 전용)
   */
  fastify.get("/", {
    schema: {
      tags: ["Users"],
      summary: "사용자 목록 조회",
      description: "사용자 목록을 페이지네이션하여 조회합니다. OWNER 권한이 필요합니다.",
      security: [{ bearerAuth: [] }],
      querystring: zodToJsonSchema(userListQuerySchema),
      response: {
        200: {
          description: "성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "array", items: { $ref: "#/components/schemas/User" } },
            pagination: { $ref: "#/components/schemas/PaginationMeta" },
          },
        },
        401: { $ref: "#/components/schemas/ErrorResponse" },
        403: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
    preHandler: requireOwner,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { page, limit, search, role, is_active } = userListQuerySchema.parse(request.query);
      const skip = (page - 1) * limit;

      // 검색 조건
      const where = {
        ...(search && {
          OR: [
            { username: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }),
        ...(role && { role }),
        ...(is_active !== undefined && { is_active }),
      };

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: adminUserListSelect,
          orderBy: { created_at: "desc" },
          skip,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return reply.send({
        success: true,
        data: users,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    },
  });

  /**
   * GET /users/me
   * 현재 로그인한 사용자 프로필 조회
   */
  fastify.get("/me", {
    schema: {
      tags: ["Users"],
      summary: "내 프로필 조회",
      description: "현재 로그인한 사용자의 프로필을 조회합니다.",
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          description: "성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { $ref: "#/components/schemas/User" },
          },
        },
        401: { $ref: "#/components/schemas/ErrorResponse" },
        404: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
    preHandler: requiredAuthenticate,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user!.userId },
        select: privateProfileSelect,
      });

      if (!user) {
        throw new NotFoundError("사용자");
      }

      return reply.send({
        success: true,
        data: user,
      });
    },
  });

  /**
   * PATCH /users/me
   * 현재 사용자 프로필 수정
   */
  fastify.patch("/me", {
    schema: {
      tags: ["Users"],
      summary: "내 프로필 수정",
      description: "현재 로그인한 사용자의 프로필을 수정합니다.",
      security: [{ bearerAuth: [] }],
      body: zodToJsonSchema(updateProfileSchema),
      response: {
        200: {
          description: "수정 성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { $ref: "#/components/schemas/User" },
            message: { type: "string" },
          },
        },
        401: { $ref: "#/components/schemas/ErrorResponse" },
        409: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
    preHandler: requiredAuthenticate,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const input = updateProfileSchema.parse(request.body);

      // 변경할 내용이 없으면 현재 프로필 반환
      if (Object.keys(input).length === 0) {
        const user = await prisma.user.findUnique({
          where: { id: request.user!.userId },
          select: privateProfileSelect,
        });

        return reply.send({
          success: true,
          data: user,
        });
      }

      // username 중복 체크
      if (input.username) {
        const existing = await prisma.user.findUnique({
          where: { username: input.username },
        });

        if (existing && existing.id !== request.user!.userId) {
          throw new ConflictError("이미 사용 중인 사용자명입니다.");
        }
      }

      const user = await prisma.user.update({
        where: { id: request.user!.userId },
        data: input,
        select: privateProfileSelect,
      });

      return reply.send({
        success: true,
        data: user,
        message: "프로필이 수정되었습니다.",
      });
    },
  });

  /**
   * PATCH /users/:id/status
   * 사용자 상태 변경 (관리자 전용 - 밴/해제)
   */
  fastify.patch("/:id/status", {
    schema: {
      tags: ["Users"],
      summary: "사용자 상태 변경",
      description: "사용자의 활성화 상태를 변경합니다. OWNER 권한이 필요합니다.",
      security: [{ bearerAuth: [] }],
      params: zodToJsonSchema(userIdParamsSchema),
      body: {
        type: "object",
        required: ["is_active"],
        properties: {
          is_active: { type: "boolean", description: "활성화 여부" },
        },
      },
      response: {
        200: {
          description: "변경 성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { $ref: "#/components/schemas/User" },
            message: { type: "string" },
          },
        },
        400: { $ref: "#/components/schemas/ErrorResponse" },
        401: { $ref: "#/components/schemas/ErrorResponse" },
        403: { $ref: "#/components/schemas/ErrorResponse" },
        404: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
    preHandler: requireOwner,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = userIdParamsSchema.parse(request.params);
      const { is_active } = z.object({ is_active: z.boolean() }).parse(request.body);

      // 자기 자신은 비활성화 불가
      if (id === request.user!.userId) {
        throw new BadRequestError("자신의 계정은 비활성화할 수 없습니다.");
      }

      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) {
        throw new NotFoundError("사용자");
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { is_active },
        select: adminUserListSelect,
      });

      return reply.send({
        success: true,
        data: updated,
        message: is_active ? "계정이 활성화되었습니다." : "계정이 비활성화되었습니다.",
      });
    },
  });

  /**
   * GET /users/:id
   * 사용자 프로필 조회 (공개 정보)
   */
  fastify.get("/:id", {
    schema: {
      tags: ["Users"],
      summary: "사용자 프로필 조회",
      description: "특정 사용자의 프로필을 조회합니다. 본인 또는 OWNER인 경우 이메일도 포함됩니다.",
      params: zodToJsonSchema(userIdParamsSchema),
      response: {
        200: {
          description: "성공",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { $ref: "#/components/schemas/User" },
          },
        },
        404: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
    preHandler: optionalAuthenticate,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = userIdParamsSchema.parse(request.params);

      // 본인 또는 OWNER면 이메일 포함
      const isOwnerOrSelf = request.user?.userId === id || request.user?.role === "OWNER";

      const user = await prisma.user.findUnique({
        where: { id },
        select: isOwnerOrSelf ? privateProfileSelect : publicProfileSelect,
      });

      if (!user) {
        throw new NotFoundError("사용자");
      }

      return reply.send({
        success: true,
        data: user,
      });
    },
  });
};

export default usersRoutes;
