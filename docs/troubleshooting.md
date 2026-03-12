# Troubleshooting

## 1. 개발 환경 쿠키 sameSite 설정 이슈

### 문제 상황

개발 환경에서 OAuth 로그인 후 쿠키가 브라우저에 저장되지 않아 인증이 유지되지 않았다.

- 원인: 쿠키의 `sameSite` 설정이 `strict`로 되어 있어 OAuth 리다이렉트(외부 → 로컬) 시 쿠키가 전송되지 않았다.

### 해결 방안

쿠키 설정의 `sameSite`를 `lax`로 변경. `lax`는 top-level 네비게이션(GET 리다이렉트)에서 쿠키 전송을 허용한다.

### 결과

OAuth 콜백 리다이렉트 시 쿠키가 정상 저장되어 인증 유지됨.

---

## 2. 토큰 갱신 시 응답 헤더 대신 쿠키 미설정 문제

### 문제 상황

백엔드의 인증 미들웨어(`middleware/auth.ts`)에서 토큰 만료 감지 후 자동 갱신 시, 새 토큰을 응답 헤더에만 포함하고 `setAuthCookies()`를 호출하지 않아 브라우저의 쿠키가 갱신되지 않았다.

### 해결 방안

인증 미들웨어의 토큰 갱신 로직에서 `setAuthCookies(reply, newAccessToken, newRefreshToken)`을 호출하여 응답에 set-cookie 헤더를 포함하도록 수정.

### 결과

미들웨어의 자동 갱신 시에도 브라우저 쿠키가 정상 갱신됨.

---

## 3. POST 요청 시 빈 body 파싱 오류

### 문제 상황

`POST /auth/refresh`, `POST /auth/logout` 등 body가 필요 없는 엔드포인트에서 프론트엔드가 body 없이 요청을 보내면 Fastify의 JSON 파서가 오류를 발생시켰다.

- 원인: 프론트엔드가 `Content-Type: application/json` 헤더를 설정하면서 body를 전송하지 않아 빈 문자열이 전달되었고, Fastify가 이를 JSON으로 파싱하지 못했다.

### 해결 방안

프론트엔드의 fetch 인스턴스에서 body가 없는 POST 요청에도 `JSON.stringify({})` 를 전송하도록 수정.

### 결과

body 파싱 오류 없이 모든 POST 엔드포인트가 정상 동작.

---

## 4. 프로덕션 배포 시 쿠키 도메인 문제

### 문제 상황

프로덕션 환경에서 `wjdalswo.xyz`(프론트엔드)와 `api.wjdalswo.xyz`(백엔드) 간 쿠키가 공유되지 않아 인증이 동작하지 않았다.

### 해결 방안

쿠키 옵션에 `domain: ".wjdalswo.xyz"` 설정 추가. 앞에 점(`.`)을 붙여 모든 서브도메인에서 쿠키가 공유되도록 한다.

```typescript
cookieOptions: {
  ...(isProduction && { domain: ".wjdalswo.xyz" }),
}
```

### 결과

프론트엔드와 백엔드 간 쿠키 공유가 정상 동작하여 인증 유지됨.
