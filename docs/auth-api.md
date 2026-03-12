# Auth API

OAuth 2.0 + BFF 패턴 기반 인증 시스템 (GitHub, Google)

## 핵심 원칙

- JWT는 **HttpOnly 쿠키**로만 전송 (XSS 방지)
- OAuth access_token은 백엔드에서만 사용
- CSRF 방지: `state` + `provider`를 쿠키에 저장하여 검증

---

## Endpoints

### OAuth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/oauth?type={provider}` | 로그인 시작 (github, google) |
| GET | `/auth/oauth/callback` | OAuth 콜백 (공통) |

### 인증 관리

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/session` | 인증 상태 확인 |
| POST | `/auth/refresh` | 토큰 갱신 |
| POST | `/auth/logout` | 로그아웃 |

---

## Flow

```
Client                    Backend                   OAuth Provider
   │                         │                            │
   │ GET /auth/oauth?type=github                          │
   │────────────────────────>│                            │
   │                         │                            │
   │   302 Redirect + state cookie                        │
   │<────────────────────────│                            │
   │                         │                            │
   │──────────────────────────────────────────────────────>│
   │                         │      사용자 인증            │
   │<──────────────────────────────────────────────────────│
   │                         │                            │
   │ GET /auth/oauth/callback?code=...&state=...          │
   │────────────────────────>│                            │
   │                         │ code → token               │
   │                         │───────────────────────────>│
   │                         │<───────────────────────────│
   │                         │ 사용자 정보 조회            │
   │                         │───────────────────────────>│
   │                         │<───────────────────────────│
   │                         │                            │
   │   302 Redirect + JWT cookies                         │
   │<────────────────────────│                            │
```

---

## Response

### GET /auth/session

```json
// 인증됨
{
  "success": true,
  "data": {
    "authenticated": true,
    "userId": "uuid",
    "role": "USER"
  }
}

// 미인증
{
  "success": true,
  "data": {
    "authenticated": false
  }
}
```

### POST /auth/refresh

```json
// 성공
{ "success": true, "message": "토큰이 갱신되었습니다." }

// 실패 (401)
{ "success": false, "error": "유효하지 않은 리프레시 토큰입니다.", "code": "UNAUTHORIZED" }
```

---

## 쿠키 설정

| Cookie | HttpOnly | MaxAge | 용도 |
|--------|----------|--------|------|
| `access_token` | O | 15분 | API 인증 |
| `refresh_token` | O | 7일 | 토큰 갱신 |
| `is_logged_in` | X | 7일 | 클라이언트 로그인 상태 체크 |
| `oauth_state` | O | 10분 | CSRF 방지 (로그인 중에만) |

**공통 옵션**: `secure` (production), `sameSite: lax`, `path: /`
**프로덕션**: `domain: .wjdalswo.xyz`

---

## Frontend 연동

### 토큰 갱신 구조

토큰 갱신은 프론트엔드에서 2가지 경로로 처리된다.

| 경로 | 위치 | 트리거 |
|------|------|--------|
| SSR | Next.js 미들웨어 (`middleware.ts`) | 페이지 요청 시 access_token 없고 refresh_token만 있을 때 |
| CSR | API 프록시 (`app/api/[...path]/route.ts`) | 클라이언트 API 호출 시 access_token 없고 refresh_token만 있을 때 |

### 인증 데이터 전달

서버 컴포넌트에서 `getUser()`로 사용자 정보를 조회한 뒤, props로 클라이언트 컴포넌트에 전달한다. 클라이언트에서 별도 인증 API를 호출하지 않는다.

```typescript
// 서버 컴포넌트
const user = await getUser();
const isOwner = user?.role === "OWNER";
return <ClientComponent isOwner={isOwner} />;
```

---

## 환경 변수

```env
FRONTEND_URL=http://localhost:3000
OAUTH_CALLBACK_URL=http://localhost:8000/auth/oauth/callback

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

---

## OAuth App 설정

### GitHub
- [GitHub Developer Settings](https://github.com/settings/developers)
- Callback URL: `http://localhost:8000/auth/oauth/callback`

### Google
- [Google Cloud Console](https://console.cloud.google.com/) > Credentials
- Redirect URI: `http://localhost:8000/auth/oauth/callback`

---

## 에러 코드

프론트엔드 리다이렉트: `{FRONTEND_URL}/auth/error?message={code}`

| Code | Description |
|------|-------------|
| `invalid_request` | OAuth 파라미터 누락 |
| `invalid_state` | CSRF 검증 실패 |
| `invalid_provider` | 지원하지 않는 제공자 |
| `account_inactive` | 비활성화된 계정 |
| `oauth_failed` | OAuth 처리 실패 |
