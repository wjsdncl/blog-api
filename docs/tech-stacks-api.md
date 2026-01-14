# Tech Stacks API

기술 스택 관리 API

## 핵심 원칙

- 기술 스택은 포트폴리오에 사용된 기술을 표시
- OWNER만 생성/수정/삭제 가능
- 카테고리별 그룹화 지원 (Frontend, Backend, DevOps 등)
- 삭제 시 포트폴리오와의 관계만 해제 (포트폴리오는 유지)

---

## Endpoints

### 조회

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/tech-stacks` | - | 기술 스택 목록 조회 |
| GET | `/tech-stacks/:id` | - | 기술 스택 상세 조회 |

### 관리 (OWNER)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/tech-stacks` | OWNER | 기술 스택 생성 |
| PATCH | `/tech-stacks/:id` | OWNER | 기술 스택 수정 |
| DELETE | `/tech-stacks/:id` | OWNER | 기술 스택 삭제 |

---

## Request & Response

### GET /tech-stacks

평탄화된 목록 + 카테고리별 그룹화 동시 반환

```json
// Response
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "React",
        "category": "Frontend",
        "portfolio_count": 5,
        "created_at": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": "uuid",
        "name": "TypeScript",
        "category": "Language",
        "portfolio_count": 8,
        "created_at": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": "uuid",
        "name": "Docker",
        "category": "DevOps",
        "portfolio_count": 3,
        "created_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "grouped": {
      "Frontend": [
        { "id": "uuid", "name": "React", "portfolio_count": 5, ... },
        { "id": "uuid", "name": "Next.js", "portfolio_count": 4, ... }
      ],
      "Language": [
        { "id": "uuid", "name": "TypeScript", "portfolio_count": 8, ... }
      ],
      "DevOps": [
        { "id": "uuid", "name": "Docker", "portfolio_count": 3, ... }
      ],
      "기타": [
        { "id": "uuid", "name": "기타 기술", "portfolio_count": 1, ... }
      ]
    }
  }
}
```

### GET /tech-stacks/:id

```json
// Response
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "React",
    "category": "Frontend",
    "portfolio_count": 5,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /tech-stacks (OWNER)

```json
// Request
{
  "name": "Vue.js",        // 필수, 1-50자, 고유값
  "category": "Frontend"   // 선택, max 50자
}

// Response (201)
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Vue.js",
    "category": "Frontend",
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "기술 스택이 생성되었습니다."
}
```

### PATCH /tech-stacks/:id (OWNER)

```json
// Request (모든 필드 선택적)
{
  "name": "Vue 3",
  "category": "Frontend Framework"
}

// Response
{
  "success": true,
  "data": { ... },
  "message": "기술 스택이 수정되었습니다."
}
```

### DELETE /tech-stacks/:id (OWNER)

```json
// Response
{
  "success": true,
  "message": "기술 스택이 삭제되었습니다."
}
```

---

## 카테고리 예시

| category | 포함 기술 예시 |
|----------|---------------|
| `Language` | TypeScript, JavaScript, Python, Go |
| `Frontend` | React, Vue.js, Svelte, Angular |
| `Backend` | Node.js, Fastify, Express, NestJS |
| `Database` | PostgreSQL, MongoDB, Redis |
| `DevOps` | Docker, Kubernetes, GitHub Actions |
| `Cloud` | AWS, GCP, Vercel, Cloudflare |
| `Tool` | Git, VS Code, Figma |

---

## 정렬 규칙

기술 스택 목록은 다음 순서로 정렬됩니다:
1. `category` 오름차순 (가나다순/ABC순)
2. `name` 오름차순 (category가 같을 경우)

카테고리가 없는 항목은 "기타"로 그룹화됩니다.

---

## 에러 응답

| Status | Code | Description |
|--------|------|-------------|
| 400 | BAD_REQUEST | 잘못된 입력값 |
| 401 | UNAUTHORIZED | 인증 필요 |
| 403 | FORBIDDEN | OWNER 권한 필요 |
| 404 | NOT_FOUND | 기술 스택 없음 |
| 409 | CONFLICT | 이름 중복 |

---

## 유효성 검사

| 필드 | 규칙 |
|------|------|
| name | 1-50자, 필수, 고유값 |
| category | max 50자 |

---

## Frontend 활용 예시

```typescript
// 기술 스택 선택 컴포넌트 (그룹화)
const TechStackSelector = ({ selected, onChange }) => {
  const { data } = useQuery({
    queryKey: ['tech-stacks'],
    queryFn: getTechStacks
  });

  return (
    <div>
      {Object.entries(data.data.grouped).map(([category, techs]) => (
        <div key={category}>
          <h4>{category}</h4>
          <div className="flex flex-wrap gap-2">
            {techs.map(tech => (
              <label key={tech.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(tech.id)}
                  onChange={() => onChange(tech.id)}
                />
                {tech.name}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// 포트폴리오 필터링
const filteredPortfolios = await fetch('/portfolios?tech=React');
```
