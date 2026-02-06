/**
 * Comment Service
 * 댓글 관련 비즈니스 로직
 */
import { prisma } from "@/lib/prismaClient.js";
import { NotFoundError, ForbiddenError, BadRequestError } from "@/lib/errors.js";

// ============================================
// Types
// ============================================

export interface CreateCommentInput {
  post_id: string;
  content: string;
  parent_id?: string;
}

export interface CreateCommentResult {
  id: string;
  content: string;
  post_id: string;
  parent_id: string | null;
  created_at: Date;
  updated_at: Date;
  author: {
    id: string;
    username: string;
    role: string;
  };
  like_count: number;
  is_liked: boolean;
}

// ============================================
// Select Objects
// ============================================

const authorSelect = {
  id: true,
  username: true,
  role: true,
} as const;

export const commentSelect = {
  id: true,
  content: true,
  post_id: true,
  parent_id: true,
  created_at: true,
  updated_at: true,
  author: {
    select: authorSelect,
  },
} as const;

// ============================================
// Service Functions
// ============================================

/**
 * 댓글 생성
 * - 게시글 존재 및 공개 상태 확인
 * - 답글인 경우 부모 댓글 검증
 * - 트랜잭션으로 댓글 생성 + comment_count 증가
 */
export async function createComment(
  input: CreateCommentInput,
  userId: string,
  isOwner: boolean
): Promise<CreateCommentResult> {
  // 게시글 존재 및 공개 상태 확인
  const post = await prisma.post.findUnique({
    where: { id: input.post_id },
    select: { id: true, status: true },
  });

  if (!post) {
    throw new NotFoundError("게시글");
  }

  if (post.status !== "PUBLISHED" && !isOwner) {
    throw new NotFoundError("게시글");
  }

  // 답글인 경우 부모 댓글 확인
  if (input.parent_id) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: input.parent_id, deleted_at: null },
      select: { id: true, post_id: true, parent_id: true },
    });

    if (!parentComment) {
      throw new NotFoundError("부모 댓글");
    }

    if (parentComment.post_id !== input.post_id) {
      throw new BadRequestError("부모 댓글이 다른 게시글에 속해 있습니다.");
    }

    // 대댓글의 대댓글은 허용하지 않음 (1단계 중첩만)
    if (parentComment.parent_id) {
      throw new BadRequestError("답글에는 답글을 달 수 없습니다.");
    }
  }

  // 트랜잭션으로 댓글 생성 + comment_count 증가
  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: {
        content: input.content,
        post_id: input.post_id,
        author_id: userId,
        parent_id: input.parent_id,
      },
      select: {
        ...commentSelect,
        _count: {
          select: {
            commentLikes: true,
          },
        },
      },
    }),
    prisma.post.update({
      where: { id: input.post_id },
      data: { comment_count: { increment: 1 } },
    }),
  ]);

  return {
    ...comment,
    like_count: comment._count.commentLikes,
    is_liked: false,
  };
}

/**
 * 댓글 삭제
 * - 작성자 또는 OWNER만 삭제 가능
 * - 트랜잭션으로 댓글 삭제 + comment_count 감소 (답글 포함)
 */
export async function deleteComment(id: string, userId: string, isOwner: boolean): Promise<void> {
  const comment = await prisma.comment.findUnique({
    where: { id, deleted_at: null },
    select: {
      id: true,
      author_id: true,
      post_id: true,
      _count: {
        select: {
          replies: { where: { deleted_at: null } },
        },
      },
    },
  });

  if (!comment) {
    throw new NotFoundError("댓글");
  }

  // 작성자 또는 OWNER만 삭제 가능
  if (comment.author_id !== userId && !isOwner) {
    throw new ForbiddenError("댓글을 삭제할 권한이 없습니다.");
  }

  // 삭제되는 댓글 수 계산 (본인 + 활성 답글)
  const deleteCount = 1 + comment._count.replies;
  const now = new Date();

  // 트랜잭션으로 soft delete + comment_count 감소
  await prisma.$transaction([
    prisma.comment.update({
      where: { id },
      data: { deleted_at: now },
    }),
    prisma.comment.updateMany({
      where: { parent_id: id, deleted_at: null },
      data: { deleted_at: now },
    }),
    prisma.post.update({
      where: { id: comment.post_id },
      data: { comment_count: { decrement: deleteCount } },
    }),
  ]);
}

/**
 * 댓글 수정
 * - 작성자만 수정 가능
 */
export async function updateComment(id: string, content: string, userId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id, deleted_at: null },
    select: { id: true, author_id: true },
  });

  if (!comment) {
    throw new NotFoundError("댓글");
  }

  // 작성자만 수정 가능
  if (comment.author_id !== userId) {
    throw new ForbiddenError("본인이 작성한 댓글만 수정할 수 있습니다.");
  }

  const updated = await prisma.comment.update({
    where: { id },
    data: { content },
    select: {
      ...commentSelect,
      _count: {
        select: {
          commentLikes: true,
        },
      },
    },
  });

  // 사용자의 좋아요 여부 확인
  const userLike = await prisma.commentLike.findUnique({
    where: {
      user_id_comment_id: { user_id: userId, comment_id: id },
    },
  });

  return {
    ...updated,
    like_count: updated._count.commentLikes,
    is_liked: !!userLike,
  };
}
