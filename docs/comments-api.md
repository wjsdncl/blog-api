# Comments API

댓글 관리 API

## 핵심 원칙

- 로그인한 사용자만 댓글 작성 가능
- 1단계 답글만 허용 (대댓글의 대댓글 불가)
- 작성자만 수정 가능, 삭제는 작성자 또는 OWNER
- 댓글 삭제는 soft delete (`deleted_at`) 방식
- 부모 댓글 삭제 시 답글도 함께 soft delete
- 삭제된 댓글(`deleted_at IS NOT NULL`)은 모든 조회에서 제외

---

## Endpoints

### 조회

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/comments?post_id=&page=&limit=` | Optional | 게시글의 댓글 목록 조회 (페이지네이션) |

### 작성/수정/삭제

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/comments` | Required | 댓글/답글 작성 |
| PATCH | `/comments/:id` | Required | 댓글 수정 (작성자만) |
| DELETE | `/comments/:id` | Required | 댓글 삭제 (작성자 또는 OWNER) |

### 좋아요

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/comments/:id/like` | Required | 좋아요/취소 토글 |

---

## Request & Response

### GET /comments?post_id=xxx&page=1&limit=20

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| post_id | UUID | O | - | 게시글 ID |
| page | number | X | 1 | 페이지 번호 |
| limit | number | X | 20 | 페이지당 댓글 수 (최대 50) |

```json
// Response (로그인 시 is_liked 포함)
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "content": "좋은 글이네요!",
      "post_id": "uuid",
      "parent_id": null,
      "like_count": 5,
      "is_liked": true,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z",
      "author": {
        "id": "uuid",
        "username": "johndoe",
        "role": "USER"
      },
      "replies": [
        {
          "id": "uuid",
          "content": "감사합니다!",
          "post_id": "uuid",
          "parent_id": "uuid",
          "like_count": 2,
          "is_liked": false,
          "created_at": "2024-01-01T00:00:00.000Z",
          "updated_at": "2024-01-01T00:00:00.000Z",
          "author": {
            "id": "uuid",
            "username": "blogowner",
            "role": "OWNER"
          }
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### POST /comments

```json
// 댓글 작성
{
  "post_id": "uuid",       // 필수
  "content": "좋은 글이네요!"  // 필수, 1-2000자
}

// 답글 작성
{
  "post_id": "uuid",
  "content": "감사합니다!",
  "parent_id": "uuid"      // 부모 댓글 ID
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "uuid",
    "content": "좋은 글이네요!",
    "post_id": "uuid",
    "parent_id": null,
    "like_count": 0,
    "is_liked": false,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z",
    "author": { ... }
  },
  "message": "댓글이 작성되었습니다."
}
```

### PATCH /comments/:id

```json
// Request
{
  "content": "수정된 댓글 내용"  // 1-2000자
}

// Response
{
  "success": true,
  "data": { ... },
  "message": "댓글이 수정되었습니다."
}
```

### DELETE /comments/:id

Soft delete 방식으로 처리됩니다. 데이터는 DB에 보존되며 `deleted_at`에 삭제 시각이 설정됩니다.
부모 댓글 삭제 시 모든 답글도 함께 soft delete 됩니다.

```json
// Response
{
  "success": true,
  "message": "댓글이 삭제되었습니다."
}
```

### POST /comments/:id/like

```json
// Response
{
  "success": true,
  "data": { "is_liked": true },
  "message": "좋아요를 눌렀습니다."
}
```

---

## 댓글 구조

```
댓글 (parent_id: null)
├── 답글 1 (parent_id: 댓글ID)
├── 답글 2 (parent_id: 댓글ID)
└── 답글 3 (parent_id: 댓글ID)
    └── 대댓글의 대댓글은 불가 (400 에러)
```

---

## 권한 체계

| 작업 | 권한 |
|------|------|
| 댓글 조회 | 누구나 (비공개 게시글은 OWNER만) |
| 댓글 작성 | 로그인 사용자 |
| 댓글 수정 | 작성자만 |
| 댓글 삭제 | 작성자 또는 OWNER |
| 좋아요 | 로그인 사용자 |

---

## 에러 응답

| Status | Code | Description |
|--------|------|-------------|
| 400 | BAD_REQUEST | 부모 댓글 게시글 불일치, 대댓글에 답글 시도 |
| 401 | UNAUTHORIZED | 인증 필요 |
| 403 | FORBIDDEN | 수정/삭제 권한 없음 |
| 404 | NOT_FOUND | 게시글, 댓글, 부모 댓글 없음 |

---

## 유효성 검사

| 필드 | 규칙 |
|------|------|
| post_id | UUID, 필수, 존재하는 게시글 |
| content | 1-2000자, 필수 |
| parent_id | UUID, 선택, 존재하는 최상위 댓글 |

---

## Frontend 활용 예시

```typescript
// 댓글 컴포넌트 구조
interface Comment {
  id: string;
  content: string;
  author: { username: string; role: string };
  like_count: number;
  is_liked: boolean;
  replies: Comment[];
}

const CommentList = ({ postId }: { postId: string }) => {
  const { data } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => getComments(postId)
  });

  return (
    <div>
      {data.data.map(comment => (
        <CommentItem key={comment.id} comment={comment}>
          {comment.replies.map(reply => (
            <ReplyItem key={reply.id} reply={reply} />
          ))}
        </CommentItem>
      ))}
    </div>
  );
};
```
