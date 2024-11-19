import * as s from "superstruct";
import isEmail from "is-email";
import isUuid from "is-uuid";

// UUID 검증을 위한 Uuid 타입 정의
const Uuid = s.define("Uuid", (value) => isUuid.v4(value));

// 유저 생성 스키마
export const CreateUser = s.object({
  email: s.define("Email", isEmail), // 이메일 형식 검증
  name: s.size(s.string(), 1, 20), // 이름의 길이를 1자에서 20자로 제한
});

// 유저 업데이트 스키마
export const UpdateUser = s.partial(CreateUser); // 모든 필드를 선택적으로 허용

// 포스트 생성 스키마
export const CreatePost = s.object({
  title: s.size(s.string(), 1, 100), // 제목은 1자에서 100자까지 허용
  content: s.string(), // 포스트 내용은 문자열이어야 함
  userId: Uuid, // userId는 UUID 형식이어야 함
  coverImg: s.optional(s.string()), // 커버 이미지 URL, 선택적 필드
  category: s.optional(s.size(s.string(), 0, 50)), // 카테고리, 선택적 필드, 최대 50자
  tags: s.optional(s.array(s.string())), // 태그는 문자열 배열로, 선택적 필드
});

// 포스트 업데이트 스키마
export const UpdatePost = s.partial(CreatePost); // 모든 필드를 선택적으로 허용

// 포스트 좋아요 스키마
export const LikePost = s.object({
  userId: Uuid,
  postId: s.integer(),
});

// 댓글 생성 스키마
export const CreateComment = s.object({
  content: s.size(s.string(), 1, 200), // 댓글 내용은 1자에서 200자까지 허용
  likes: s.optional(s.min(s.integer(), 0)), // 좋아요 수는 0 이상, 선택적 필드
  userId: s.optional(Uuid), // userId는 UUID 형식이며, 선택적 필드
  postId: s.integer(), // postId는 정수형이어야 함
  parentCommentId: s.optional(s.integer()), // 부모 댓글 ID, 선택적 필드
});

// 댓글 업데이트 스키마
export const UpdateComment = s.partial(CreateComment); // 모든 필드를 선택적으로 허용

// 댓글 좋아요 스키마
export const LikeComment = s.object({
  userId: Uuid,
  commentId: s.integer(),
});

// 프로젝트 생성 스키마
export const CreateProject = s.object({
  title: s.size(s.string(), 1, 100),
  isPersonal: s.boolean(),
  startDate: s.string(),
  endDate: s.optional(s.string()),
  description: s.string(),
  content: s.string(),
  summary: s.array(s.string()),
  techStack: s.array(s.string()),
  githubLink: s.optional(s.string()),
  projectLink: s.optional(s.string()),
});

// 프로젝트 업데이트 스키마
export const UpdateProject = s.partial(CreateProject); // 모든 필드를 선택적으로 허용
