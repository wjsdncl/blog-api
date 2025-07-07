import * as s from 'superstruct';

import isUuid from 'is-uuid';

// Custom types
const Uuid = s.define('Uuid', (value) => isUuid.v4(value));


// (Signup schema removed – GitHub OAuth only)


export const UpdateUser = s.partial(
  s.object({
    name: s.size(s.string(), 1, 20),
  })
);

// Post schemas
export const CreatePost = s.object({
  title: s.size(s.string(), 1, 100),
  content: s.string(),
  thumbnail: s.optional(s.string()),
  categoryId: s.optional(s.integer()),
  tags: s.optional(s.array(s.string())),
  isPrivate: s.optional(s.boolean()),
});

export const UpdatePost = s.partial(CreatePost);

// Comment schemas
export const CreateComment = s.object({
  content: s.size(s.string(), 1, 1000),
  postId: s.integer(),
  parentCommentId: s.optional(s.integer()),
});

export const UpdateComment = s.object({
  content: s.size(s.string(), 1, 1000),
});

// Project schemas
export const CreateProject = s.object({
  title: s.size(s.string(), 1, 100),
  description: s.string(),
  summary: s.array(s.string()),
  content: s.string(),
  images: s.array(s.string()),
  startDate: s.string(), // ISO 8601 format
  endDate: s.optional(s.string()), // ISO 8601 format
  isPersonal: s.optional(s.boolean()),
  isActive: s.optional(s.boolean()),
  priority: s.optional(s.integer()),
  githubUrl: s.optional(s.string()),
  projectUrl: s.optional(s.string()),
  categoryId: s.optional(s.integer()),
  tags: s.optional(s.array(s.string())),
  techStack: s.optional(s.array(s.string())),
  links: s.optional(
    s.array(
      s.object({
        name: s.string(),
        url: s.string(),
      })
    )
  ),
});

export const UpdateProject = s.partial(CreateProject);

// LikeComment schema
export const LikeComment = s.object({
  userId: Uuid,
  commentId: s.integer(),
});
