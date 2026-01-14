# Portfolios API

포트폴리오 (프로젝트) 관리 API

## 핵심 원칙

- 포트폴리오는 개인 프로젝트를 소개하는 콘텐츠
- OWNER만 생성/수정/삭제 가능
- 기술 스택, 태그, 링크 연결 지원
- 슬러그는 제목에서 자동 생성

---

## Endpoints

### 조회

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/portfolios` | Optional | 포트폴리오 목록 조회 |
| GET | `/portfolios/:slug` | Optional | 포트폴리오 상세 조회 |

### 관리 (OWNER)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/portfolios` | OWNER | 포트폴리오 생성 |
| PATCH | `/portfolios/:id` | OWNER | 포트폴리오 수정 |
| DELETE | `/portfolios/:id` | OWNER | 포트폴리오 삭제 |

---

## Request & Response

### GET /portfolios

```
Query Parameters:
- page: number (default: 1)
- limit: number (default: 10, max: 50)
- status: "DRAFT" | "PUBLISHED" | "SCHEDULED" (OWNER만)
- category: string (category slug)
- tag: string (tag slug)
- tech: string (tech stack name, 대소문자 무관)
```

```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "개인 블로그",
      "slug": "개인-블로그",
      "excerpt": "Next.js로 만든 개인 블로그",
      "cover_image": "https://...",
      "start_date": "2024-01-01",
      "end_date": null,
      "status": "PUBLISHED",
      "view_count": 50,
      "order": 0,
      "published_at": "2024-01-01T00:00:00.000Z",
      "created_at": "2024-01-01T00:00:00.000Z",
      "category": { "id": "uuid", "name": "웹", "slug": "웹" },
      "tags": [{ "id": "uuid", "name": "Next.js", "slug": "nextjs" }],
      "techStacks": [
        { "id": "uuid", "name": "React", "category": "Frontend" },
        { "id": "uuid", "name": "TypeScript", "category": "Language" }
      ]
    }
  ],
  "pagination": { ... }
}
```

### GET /portfolios/:slug

```json
// Response
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "개인 블로그",
    "slug": "개인-블로그",
    "content": "# 프로젝트 상세 내용...",
    "excerpt": "Next.js로 만든 개인 블로그",
    "cover_image": "https://...",
    "start_date": "2024-01-01",
    "end_date": null,
    "status": "PUBLISHED",
    "view_count": 51,
    "order": 0,
    "published_at": "2024-01-01T00:00:00.000Z",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z",
    "category": { ... },
    "tags": [ ... ],
    "techStacks": [ ... ],
    "links": [
      { "id": "uuid", "type": "github", "url": "https://github.com/...", "label": "GitHub", "order": 0 },
      { "id": "uuid", "type": "live", "url": "https://...", "label": "Live Demo", "order": 1 }
    ]
  }
}
```

### POST /portfolios (OWNER)

```json
// Request
{
  "title": "새 프로젝트",           // 필수, 1-200자
  "content": "프로젝트 상세 설명",   // 필수
  "excerpt": "짧은 소개",           // 선택, max 500자
  "cover_image": "https://...",     // 선택, URL
  "start_date": "2024-01-01",       // 선택
  "end_date": null,                 // 선택, null=진행중
  "status": "DRAFT",                // 선택, default: DRAFT
  "order": 0,                       // 선택, 정렬 순서
  "category_id": "uuid",            // 선택
  "tag_ids": ["uuid"],              // 선택, max 10개
  "tech_stack_ids": ["uuid"],       // 선택, max 20개
  "links": [                        // 선택, max 10개
    {
      "type": "github",             // 필수
      "url": "https://github.com/...",  // 필수, URL
      "label": "GitHub",            // 선택
      "order": 0                    // 선택
    }
  ],
  "published_at": "2024-01-01"      // 선택, 예약발행 시간
}

// Response (201)
{
  "success": true,
  "data": { ... },
  "message": "포트폴리오가 생성되었습니다."
}
```

### PATCH /portfolios/:id (OWNER)

모든 필드 선택적 업데이트 가능
- `links` 업데이트 시 기존 링크 전체 교체

```json
// Request
{
  "title": "수정된 제목",
  "links": [
    { "type": "github", "url": "https://github.com/..." },
    { "type": "live", "url": "https://..." }
  ]
}

// Response
{
  "success": true,
  "data": { ... },
  "message": "포트폴리오가 수정되었습니다."
}
```

### DELETE /portfolios/:id (OWNER)

```json
// Response
{
  "success": true,
  "message": "포트폴리오가 삭제되었습니다."
}
```

---

## 링크 타입 예시

| type | 설명 |
|------|------|
| `github` | GitHub 저장소 |
| `live` | 배포된 사이트 |
| `demo` | 데모 영상/페이지 |
| `figma` | Figma 디자인 |
| `notion` | Notion 문서 |

---

## 정렬 규칙

포트폴리오 목록은 다음 순서로 정렬됩니다:
1. `order` 오름차순
2. `created_at` 내림차순 (order가 같을 경우)

---

## 에러 응답

| Status | Code | Description |
|--------|------|-------------|
| 400 | BAD_REQUEST | 잘못된 입력값, 존재하지 않는 카테고리 |
| 401 | UNAUTHORIZED | 인증 필요 |
| 403 | FORBIDDEN | OWNER 권한 필요 |
| 404 | NOT_FOUND | 포트폴리오 없음 또는 비공개 |

---

## 유효성 검사

| 필드 | 규칙 |
|------|------|
| title | 1-200자, 필수 |
| content | 필수 |
| excerpt | max 500자 |
| cover_image | 유효한 URL |
| tag_ids | max 10개 |
| tech_stack_ids | max 20개 |
| links | max 10개 |
| links[].type | 1-50자, 필수 |
| links[].url | 유효한 URL, 필수 |
| links[].label | max 100자 |

---

## Frontend 활용 예시

```typescript
// 포트폴리오 카드 컴포넌트
const PortfolioCard = ({ portfolio }) => (
  <div>
    <img src={portfolio.cover_image} alt={portfolio.title} />
    <h3>{portfolio.title}</h3>
    <p>{portfolio.excerpt}</p>

    {/* 기술 스택 뱃지 */}
    <div className="flex gap-1">
      {portfolio.techStacks.map(tech => (
        <span key={tech.id}>{tech.name}</span>
      ))}
    </div>

    {/* 진행 기간 */}
    <span>
      {portfolio.start_date} ~ {portfolio.end_date || '진행중'}
    </span>
  </div>
);
```
