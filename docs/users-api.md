# Users API

사용자 프로필 관리 API

## 권한 체계

| 역할 | 설명 |
|------|------|
| `USER` | 일반 사용자 (본인 프로필만 수정 가능) |
| `OWNER` | 블로그 관리자 (모든 사용자 관리 가능) |

---

## Endpoints

### 프로필 관리

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | Required | 내 프로필 조회 |
| PATCH | `/users/me` | Required | 내 프로필 수정 |
| GET | `/users/:id` | Optional | 사용자 프로필 조회 |

### 관리자 전용 (OWNER)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users` | OWNER | 사용자 목록 조회 |
| PATCH | `/users/:id/status` | OWNER | 사용자 상태 변경 (밴/해제) |

---

## Request & Response

### GET /users/me

내 프로필 조회 (이메일 포함)

```json
// Response
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "USER",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### PATCH /users/me

```json
// Request
{
  "username": "newname"  // 2-30자, 영문/숫자/밑줄/한글
}

// Response
{
  "success": true,
  "data": { ... },
  "message": "프로필이 수정되었습니다."
}
```

### GET /users/:id

```json
// 타인 조회 시 (공개 정보만)
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "role": "USER",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}

// 본인 또는 OWNER 조회 시 (이메일 포함)
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "USER",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### GET /users (OWNER)

```
Query Parameters:
- page: number (default: 1)
- limit: number (default: 20, max: 100)
- search: string (username, email 검색)
- role: "USER" | "OWNER"
- is_active: "true" | "false"
```

```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "johndoe",
      "email": "john@example.com",
      "role": "USER",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### PATCH /users/:id/status (OWNER)

```json
// Request
{
  "is_active": false  // 밴 처리
}

// Response
{
  "success": true,
  "data": { ... },
  "message": "계정이 비활성화되었습니다."
}
```

---

## 에러 응답

| Status | Code | Description |
|--------|------|-------------|
| 400 | BAD_REQUEST | 자기 자신 비활성화 시도 |
| 401 | UNAUTHORIZED | 인증 필요 |
| 403 | FORBIDDEN | OWNER 권한 필요 |
| 404 | NOT_FOUND | 사용자 없음 |
| 409 | CONFLICT | 사용자명 중복 |

---

## 유효성 검사

### username
- 2-30자
- 영문, 숫자, 밑줄(`_`), 한글만 허용
- 고유값 (중복 불가)
