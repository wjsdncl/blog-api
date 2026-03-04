/**
 * 좋아요 서비스
 *
 * 게시글/댓글 공통 토글 방식 (이미 좋아요 → 취소, 없으면 → 추가).
 * 게시글 좋아요는 트랜잭션으로 like_count 동기화, 댓글은 _count로 집계.
 */
import { prisma } from "@/lib/prismaClient.js";
import { NotFoundError } from "@/lib/errors.js";

type LikeTarget = "post" | "comment";

interface ToggleLikeResult {
  isLiked: boolean;
  message: string;
}

/**
 * 좋아요 토글 (추가/취소)
 */
export async function toggleLike(
  target: LikeTarget,
  targetId: string,
  userId: string
): Promise<ToggleLikeResult> {
  // 대상 엔티티 존재 및 공개 상태 확인
  if (target === "post") {
    const post = await prisma.post.findUnique({
      where: { id: targetId },
      select: { id: true, status: true },
    });

    if (!post || post.status !== "PUBLISHED") {
      throw new NotFoundError("게시글");
    }

    return togglePostLike(targetId, userId);
  } else {
    const comment = await prisma.comment.findUnique({
      where: { id: targetId, deleted_at: null },
      select: { id: true },
    });

    if (!comment) {
      throw new NotFoundError("댓글");
    }

    return toggleCommentLike(targetId, userId);
  }
}

/**
 * 게시글 좋아요 토글
 */
async function togglePostLike(postId: string, userId: string): Promise<ToggleLikeResult> {
  const existingLike = await prisma.postLike.findUnique({
    where: {
      user_id_post_id: { user_id: userId, post_id: postId },
    },
  });

  if (existingLike) {
    // 트랜잭션으로 좋아요 삭제 + like_count 감소
    await prisma.$transaction([
      prisma.postLike.delete({
        where: { id: existingLike.id },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { like_count: { decrement: 1 } },
      }),
    ]);

    return {
      isLiked: false,
      message: "좋아요가 취소되었습니다.",
    };
  }

  // 트랜잭션으로 좋아요 생성 + like_count 증가
  await prisma.$transaction([
    prisma.postLike.create({
      data: {
        user_id: userId,
        post_id: postId,
      },
    }),
    prisma.post.update({
      where: { id: postId },
      data: { like_count: { increment: 1 } },
    }),
  ]);

  return {
    isLiked: true,
    message: "좋아요를 눌렀습니다.",
  };
}

/**
 * 댓글 좋아요 토글
 */
async function toggleCommentLike(commentId: string, userId: string): Promise<ToggleLikeResult> {
  const existingLike = await prisma.commentLike.findUnique({
    where: {
      user_id_comment_id: { user_id: userId, comment_id: commentId },
    },
  });

  if (existingLike) {
    await prisma.commentLike.delete({
      where: { id: existingLike.id },
    });

    return {
      isLiked: false,
      message: "좋아요가 취소되었습니다.",
    };
  }

  await prisma.commentLike.create({
    data: {
      user_id: userId,
      comment_id: commentId,
    },
  });

  return {
    isLiked: true,
    message: "좋아요를 눌렀습니다.",
  };
}