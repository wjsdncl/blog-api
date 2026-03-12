# Upload API

이미지 업로드 API (Supabase Storage)

## 핵심 원칙

- 로그인한 사용자만 업로드 가능
- 허용 형식: JPEG, PNG, GIF, WEBP
- 최대 파일 크기: 10MB
- 업로드된 파일은 Supabase Storage `images` 버킷에 저장

---

## Endpoint

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/upload` | Required | 이미지 업로드 |

---

## Request & Response

### POST /upload

`multipart/form-data` 형식으로 파일을 전송한다.

```
Content-Type: multipart/form-data
Field name: file
```

```json
// Response (200)
{
  "success": true,
  "url": "https://zrkselfyyqkkqcmxhjlt.supabase.co/storage/v1/object/public/images/posts/a1b2c3d4-filename.png"
}
```

---

## 파일 저장 경로

```
images/posts/{uuid8자리}-{안전한파일명}
```

파일명의 특수문자는 `_`로 치환된다.

---

## 제약 사항

| 항목 | 값 |
|------|-----|
| 허용 MIME 타입 | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| 최대 파일 크기 | 10MB |
| 인증 | 로그인 필수 |

---

## 에러 응답

| Status | Description |
|--------|-------------|
| 400 | 파일 미첨부, 지원하지 않는 형식, 크기 초과, 업로드 실패 |
| 401 | 인증 필요 |
