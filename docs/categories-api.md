# Categories API

게시글 카테고리 관리 API

## 핵심 원칙

- 카테고리는 게시글과 포트폴리오를 분류하는 데 사용
- OWNER만 카테고리 생성/수정/삭제 가능
- 게시글이 있는 카테고리는 삭제 불가
- 슬러그는 이름에서 자동 생성
- `post_count`로 각 카테고리의 게시글 수 확인 가능

---

## Endpoints

### 조회

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/categories` | - | 카테고리 목록 조회 |
| GET | `/categories/:slug` | - | 카테고리 상세 조회 |

### 관리 (OWNER)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/categories` | OWNER | 카테고리 생성 |
| PATCH | `/categories/:id` | OWNER | 카테고리 수정 |
| DELETE | `/categories/:id` | OWNER | 카테고리 삭제 |

---

## Request & Response

### GET /categories

전체 카테고리 목록 + 전체 게시글 수

```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "개발",
      "slug": "개발",
      "order": 0,
      "post_count": 15,
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "uuid",
      "name": "일상",
      "slug": "일상",
      "order": 1,
      "post_count": 8,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "totalPostCount": 42
}
```

### GET /categories/:slug

```json
// Response
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "개발",
    "slug": "개발",
    "order": 0,
    "post_count": 15,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /categories (OWNER)

```json
// Request
{
  "name": "새 카테고리",   // 필수, 1-50자, 고유값
  "order": 0              // 선택, 정렬 순서
}

// Response (201) - slug 자동 생성
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "새 카테고리",
    "slug": "새-카테고리",
    "order": 0,
    "post_count": 0,
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "카테고리가 생성되었습니다."
}
```

### PATCH /categories/:id (OWNER)

```json
// Request (모든 필드 선택적)
{
  "name": "수정된 이름",    // 이름 변경 시 slug도 재생성
  "order": 1
}

// Response
{
  "success": true,
  "data": { ... },
  "message": "카테고리가 수정되었습니다."
}
```

### DELETE /categories/:id (OWNER)

```json
// 성공 시
{
  "success": true,
  "message": "카테고리가 삭제되었습니다."
}

// 게시글이 있는 경우 (409)
{
  "success": false,
  "error": "이 카테고리에 15개의 게시글이 있습니다. 게시글을 먼저 이동하거나 삭제해주세요.",
  "code": "CONFLICT"
}
```

---

## 슬러그 생성 규칙

- 소문자 변환
- 공백 → 하이픈
- 특수문자 제거 (한글은 유지)
- 중복 시 숫자 suffix 추가

```
"개발"       → "개발"
"Web 개발"   → "web-개발"
"React.js"   → "reactjs"
```

---

## 정렬 규칙

카테고리 목록은 다음 순서로 정렬됩니다:
1. `order` 오름차순
2. `name` 오름차순 (order가 같을 경우)

---

## 에러 응답

| Status | Code | Description |
|--------|------|-------------|
| 400 | BAD_REQUEST | 잘못된 입력값 |
| 401 | UNAUTHORIZED | 인증 필요 |
| 403 | FORBIDDEN | OWNER 권한 필요 |
| 404 | NOT_FOUND | 카테고리 없음 |
| 409 | CONFLICT | 이름 중복 또는 게시글 존재 |

---

## 유효성 검사

| 필드 | 규칙 |
|------|------|
| name | 1-50자, 필수, 고유값 |
| slug | 자동 생성, 고유값 |
| order | 0 이상 정수 |

---

## Frontend 활용 예시

```typescript
// 카테고리 필터 UI
const { data } = await fetch('/categories');

// 전체 + 각 카테고리 탭 생성
const tabs = [
  { name: '전체', slug: null, count: data.totalPostCount },
  ...data.data.map(cat => ({
    name: cat.name,
    slug: cat.slug,
    count: cat.post_count
  }))
];

// 카테고리별 게시글 조회
const posts = await fetch(`/posts?category=${category.slug}`);

// 카테고리 상세 페이지
const category = await fetch(`/categories/${slug}`);
```
