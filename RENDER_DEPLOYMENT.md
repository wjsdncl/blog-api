# Render.com 배포 가이드

## 🚀 Render.com에서 데이터 마이그레이션 실행하기

### 방법 1: 빌드 시 자동 마이그레이션

Render.com의 Build Command에서 데이터베이스 마이그레이션과 함께 데이터 마이그레이션을 실행:

```bash
npm ci && npm run build && npx prisma migrate deploy && npm run migrate:blog-data
```

### 방법 2: 수동 마이그레이션 (권장)

안전한 프로덕션 배포를 위해 수동으로 마이그레이션 실행:

1. **Render.com 대시보드에서 Shell 접속**
2. **환경 확인 및 마이그레이션 실행**

```bash
# 환경 확인
echo $NODE_ENV
echo $DATABASE_URL

# 데이터베이스 스키마 마이그레이션
npx prisma migrate deploy

# 데이터 마이그레이션 (안전 모드)
npm run migrate:blog-data

# 강제 마이그레이션 (기존 데이터가 있을 경우)
FORCE_MIGRATION=true npm run migrate:blog-data
```

### 방법 3: 환경변수 설정으로 자동화

Render.com 환경변수에 다음을 추가:

```env
AUTO_MIGRATE_DATA=true
FORCE_MIGRATION=false
```

## 📋 환경변수 체크리스트

다음 환경변수들이 Render.com에 설정되어 있는지 확인하세요:

### 필수 환경변수

- `DATABASE_URL` - PostgreSQL 연결 문자열
- `JWT_SECRET` - JWT 토큰 암호화 키
- `JWT_REFRESH_SECRET` - Refresh 토큰 암호화 키
- `NODE_ENV=production`

### GitHub OAuth (선택사항)

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL`

### Supabase (이미지 업로드용, 선택사항)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### 마이그레이션 제어용

- `AUTO_MIGRATE_DATA=true` (자동 마이그레이션 활성화)
- `FORCE_MIGRATION=false` (기존 데이터 보호)

## 🔒 보안 주의사항

1. **프로덕션 환경에서는 기존 데이터 확인 후 마이그레이션**
2. **FORCE_MIGRATION은 신중하게 사용**
3. **마이그레이션 전 데이터베이스 백업 권장**

## 📊 마이그레이션 확인

마이그레이션 완료 후 다음 엔드포인트로 확인:

```bash
curl https://your-app.onrender.com/health
```

예상 응답:

```json
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2025-07-13T10:30:00.000Z",
  "uptime": 3600
}
```
