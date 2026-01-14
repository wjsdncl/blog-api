# Tags API

태그 관리 API

## 핵심 원칙

- 태그는 게시글과 포트폴리오에 다중 연결 가능 (M:N 관계)
- OWNER만 태그 생성/수정/삭제 가능
- 태그 삭제 시 연결된 게시글에서 자동으로 관계 해제
- 슬러그는 이름에서 자동 생성

---

## Endpoints

### 조회

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/tags` | - | 태그 목록 조회 |
| GET | `/tags/:slug` | - | 태그 상세 조회 |

### 관리 (OWNER)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/tags` | OWNER | 태그 생성 |
| PATCH | `/tags/:id` | OWNER | 태그 수정 |
| DELETE | `/tags/:id` | OWNER | 태그 삭제 |

---

## Request & Response

### GET /tags

전체 태그 목록 + 전체 게시글 수

```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "TypeScript",
      "slug": "typescript",
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "uuid",
      "name": "React",
      "slug": "react",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "totalPostCount": 42
}
```

### GET /tags/:slug

```json
// Response
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "TypeScript",
    "slug": "typescript",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /tags (OWNER)

```json
// Request
{
  "name": "Next.js"    // 필수, 1-30자, 고유값
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Next.js",
    "slug": "nextjs",
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "태그가 생성되었습니다."
}
```

### PATCH /tags/:id (OWNER)

```json
// Request (모든 필드 선택적)
{
  "name": "Next.js 14"
}

// Response
{
  "success": true,
  "data": { ... },
  "message": "태그가 수정되었습니다."
}
```

### DELETE /tags/:id (OWNER)

```json
// Response
{
  "success": true,
  "message": "태그가 삭제되었습니다."
}
```

---

## 슬러그 생성 규칙

- 소문자 변환
- 공백 → 하이픈
- 특수문자 제거 (한글은 유지)
- 중복 시 숫자 suffix 추가

```
"TypeScript"    → "typescript"
"Next.js"       → "nextjs"
"타입스크립트"   → "타입스크립트"
"React 18"      → "react-18"
```

---

## 정렬 규칙

태그 목록은 `name` 오름차순 (가나다순/ABC순)

---

## 에러 응답

| Status | Code | Description |
|--------|------|-------------|
| 400 | BAD_REQUEST | 잘못된 입력값 |
| 401 | UNAUTHORIZED | 인증 필요 |
| 403 | FORBIDDEN | OWNER 권한 필요 |
| 404 | NOT_FOUND | 태그 없음 |
| 409 | CONFLICT | 이름 중복 |

---

## 유효성 검사

| 필드 | 규칙 |
|------|------|
| name | 1-30자, 필수, 고유값 |
| slug | 자동 생성, 고유값 |

---

## Frontend 활용 예시

```typescript
// 태그 목록 조회
const { data } = await fetch('/tags');

// 게시글 목록에서 태그 필터링
const posts = await fetch('/posts?tag=typescript');

// 태그 클라우드 컴포넌트
const TagCloud = () => {
  const { data } = useQuery({ queryKey: ['tags'], queryFn: getTags });

  return (
    <div className="flex flex-wrap gap-2">
      {data.data.map(tag => (
        <Link key={tag.id} href={`/posts?tag=${tag.slug}`}>
          {tag.name}
        </Link>
      ))}
    </div>
  );
};
```
