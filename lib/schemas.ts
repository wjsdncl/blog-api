import { z } from "zod";

// User schemas
export const UpdateUserSchema = z
  .object({
    name: z.string().min(1).max(20).optional(),
  })
  .partial();

export type UpdateUser = z.infer<typeof UpdateUserSchema>;

// Post schemas
export const CreatePostSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string(),
  thumbnail: z.string().optional(),
  categoryId: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  isPrivate: z.boolean().optional(),
});

export const UpdatePostSchema = CreatePostSchema.partial();

export type CreatePost = z.infer<typeof CreatePostSchema>;
export type UpdatePost = z.infer<typeof UpdatePostSchema>;

// Comment schemas
export const CreateCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  postId: z.number().int(),
  parentCommentId: z.number().int().optional(),
});

export const UpdateCommentSchema = z.object({
  content: z.string().min(1).max(1000),
});

export type CreateComment = z.infer<typeof CreateCommentSchema>;
export type UpdateComment = z.infer<typeof UpdateCommentSchema>;

// Project schemas
export const CreateProjectSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string(),
  summary: z.array(z.string()),
  content: z.string(),
  images: z.array(z.string()),
  startDate: z.string(), // ISO 8601 format
  endDate: z.string().optional(), // ISO 8601 format
  isPersonal: z.boolean().optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
  categoryId: z.number().int().optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export type CreateProject = z.infer<typeof CreateProjectSchema>;
export type UpdateProject = z.infer<typeof UpdateProjectSchema>;

// LikeComment schema
export const LikeCommentSchema = z.object({
  userId: z.string().uuid(),
  commentId: z.number().int(),
});

export type LikeComment = z.infer<typeof LikeCommentSchema>;
