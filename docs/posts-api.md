# Posts API

블로그 게시글 관리 API

## 핵심 원칙

- 게시글 상태: `DRAFT`(임시저장), `PUBLISHED`(공개), `SCHEDULED`(예약발행)
- OWNER만 게시글 작성/수정/삭제 가능
- 일반 사용자는 `PUBLISHED` 상태의 게시글만 조회 가능
- 슬러그는 제목에서 자동 생성

---

## Endpoints

### 조회

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/posts` | Optional | 게시글 목록 조회 |
| GET | `/posts/:slug` | Optional | 게시글 상세 조회 |

### 관리 (OWNER)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/posts` | OWNER | 게시글 작성 |
| PATCH | `/posts/:id` | OWNER | 게시글 수정 |
| DELETE | `/posts/:id` | OWNER | 게시글 삭제 |

### 좋아요

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/posts/:id/like` | Required | 좋아요/취소 토글 |

---

## Request & Response

### GET /posts

```
Query Parameters:
- page: number (default: 1)
- limit: number (default: 10, max: 50)
- status: "DRAFT" | "PUBLISHED" | "SCHEDULED" (OWNER만)
- category: string (category slug)
- tag: string (tag slug)
- search: string (제목, 내용 검색)
```

```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "첫 번째 게시글",
      "slug": "첫-번째-게시글",
      "excerpt": "요약...",
      "cover_image": "https://...",
      "status": "PUBLISHED",
      "view_count": 100,
      "like_count": 10,
      "comment_count": 5,
      "published_at": "2024-01-01T00:00:00.000Z",
      "created_at": "2024-01-01T00:00:00.000Z",
      "category": {
        "id": "uuid",
        "name": "개발"
      },
      "tags": [
        { "id": "uuid", "name": "TypeScript", "slug": "typescript" }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### GET /posts/:slug

```json
// Response (로그인 시 isLiked 포함)
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "첫 번째 게시글",
    "slug": "첫-번째-게시글",
    "content": "# 본문 내용...",
    "excerpt": "요약...",
    "cover_image": "https://...",
    "status": "PUBLISHED",
    "view_count": 101,
    "like_count": 10,
    "comment_count": 5,
    "published_at": "2024-01-01T00:00:00.000Z",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z",
    "isLiked": true,
    "category": { ... },
    "tags": [ ... ]
  }
}
```

### POST /posts (OWNER)

```json
// Request
{
  "title": "새 게시글",           // 필수, 1-200자
  "content": "본문 내용",         // 필수
  "excerpt": "요약",              // 선택, max 500자
  "cover_image": "https://...",   // 선택, URL
  "status": "DRAFT",              // 선택, default: DRAFT
  "category_id": "uuid",          // 선택
  "tag_ids": ["uuid", "uuid"],    // 선택, max 10개
  "published_at": "2024-01-01"    // 선택, 예약발행 시간
}

// Response (201)
{
  "success": true,
  "data": { ... },
  "message": "게시글이 작성되었습니다."
}
```

### PATCH /posts/:id (OWNER)

모든 필드 선택적 업데이트 가능

```json
// Request
{
  "title": "수정된 제목",
  "status": "PUBLISHED"
}

// Response
{
  "success": true,
  "data": { ... },
  "message": "게시글이 수정되었습니다."
}
```

### DELETE /posts/:id (OWNER)

```json
// Response
{
  "success": true,
  "message": "게시글이 삭제되었습니다."
}
```

### POST /posts/:id/like

토글 방식 (이미 좋아요 → 취소, 없으면 → 추가)

```json
// Response
{
  "success": true,
  "data": { "isLiked": true },
  "message": "좋아요를 눌렀습니다."
}
```

---

## 게시글 상태 흐름

```
DRAFT ──────────────────────┐
  │                         │
  │ status: PUBLISHED       │ status: SCHEDULED
  │ (published_at: now)     │ (published_at: 예약시간)
  ▼                         ▼
PUBLISHED              SCHEDULED
                           │
                           │ 예약시간 도래
                           ▼
                       PUBLISHED
```

---

## 조회수 증가 규칙

- OWNER가 조회할 때는 조회수 증가하지 않음
- 일반 사용자가 상세 페이지 조회 시 +1

---

## 에러 응답

| Status | Code | Description |
|--------|------|-------------|
| 400 | BAD_REQUEST | 잘못된 입력값, 존재하지 않는 카테고리 |
| 401 | UNAUTHORIZED | 인증 필요 |
| 403 | FORBIDDEN | OWNER 권한 필요 |
| 404 | NOT_FOUND | 게시글 없음 또는 비공개 |

---

## 유효성 검사

| 필드 | 규칙 |
|------|------|
| title | 1-200자, 필수 |
| content | 필수 |
| excerpt | max 500자 |
| cover_image | 유효한 URL |
| tag_ids | max 10개 |
