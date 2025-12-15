# Production Database Migration Guide

## 현재 상태
- ✅ 로컬 개발 완료: Fastify + 새 스키마 (UUID 기반)
- ✅ 타입 체크 통과
- ✅ 개발 서버 정상 실행
- ✅ GitHub 푸시 완료

## Render 배포 단계

### 1. Render PostgreSQL 준비

**옵션 A: 기존 DB 리셋 (권장 - 개발 단계)**
```bash
# Render 대시보드에서:
1. PostgreSQL 인스턴스 선택 (dpg-crm1h588fa8c739vuh6g-a)
2. "Reset Database" 클릭
3. 확인 후 리셋
```

**옵션 B: 새 PostgreSQL 인스턴스 생성**
```bash
# Render 대시보드에서:
1. New > PostgreSQL
2. Name: wjsdncl-blog-db-v2
3. Database: blog_prod
4. User: postgres
5. Region: Singapore
6. Plan: Free/Starter
7. Create Database
```

### 2. Render Web Service 환경 변수 업데이트

Render 대시보드 > blog-api > Environment 탭:

```env
# PostgreSQL
DATABASE_URL=<Render에서 제공하는 Internal Database URL>

# Port
PORT=3000

# JWT Secrets
JWT_SECRET=<강력한 시크릿키>
JWT_REFRESH_SECRET=<강력한 리프레시 시크릿키>

# Supabase (GitHub OAuth용)
SUPABASE_URL=https://zrkselfyyqkkqcmxhjlt.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# GitHub OAuth
GITHUB_CLIENT_ID=<프로덕션용 GitHub OAuth Client ID>
GITHUB_CLIENT_SECRET=<프로덕션용 GitHub OAuth Client Secret>
GITHUB_CALLBACK_URL=https://your-blog-api.onrender.com/auth/callback
CLIENT_URL=https://your-blog.vercel.app

# Dev용 (선택사항)
GITHUB_CLIENT_ID_DEV=Ov23liGuFvwkuTzLgRLg
GITHUB_CLIENT_SECRET_DEV=b8a11b1a865426ef5be458aa73d9c8ac981cd417
GITHUB_CALLBACK_URL_DEV=http://localhost:3000/auth/callback

# Node 환경
NODE_ENV=production
```

### 3. Render Build & Deploy 설정

#### Build Command (업데이트 필요)
```bash
npm install && npx prisma generate && npm run build
```

#### Start Command
```bash
npm start
```

#### 또는 prisma migrate를 포함한 빌드:
```bash
npm install && npx prisma migrate deploy && npx prisma generate && npm run build
```

### 4. 배포 후 마이그레이션 실행

Render Shell에서 수동 실행:
```bash
# Render 대시보드 > blog-api > Shell 탭
npx prisma migrate deploy
```

### 5. 배포 확인

```bash
# Health Check
curl https://your-blog-api.onrender.com/health

# 예상 응답:
{
  "status": "ok",
  "timestamp": "2025-12-15T13:30:00.000Z",
  "environment": "production"
}
```

## 데이터 마이그레이션 (선택사항)

기존 데이터를 보존하려면:

### 준비 파일
- 백업 위치: `backup/database/backup_2025-12-01.md`
- 11 users, 15 posts, 26 comments

### 마이그레이션 스크립트 작성 필요
```typescript
// scripts/migrate-old-data.ts
// 기존 데이터를 새 UUID 스키마로 변환
// 1. User 데이터 변환
// 2. Post 데이터 변환 (is_private -> published)
// 3. Comment 데이터 변환 (parent_comment_id -> parent_id)
// 4. Like 관계 재생성
```

**Note**: 현재는 개발 단계이므로 데이터 마이그레이션 생략하고 새로 시작하는 것을 권장합니다.

## Breaking Changes 체크리스트

프론트엔드에서 다음 사항 업데이트 필요:

### API 엔드포인트
- ✅ 동일 (변경 없음)

### Request/Response 필드
- ❌ `id`: number → string (UUID)
- ❌ `isPrivate` → `published` (boolean 반전)
- ❌ `thumbnail` → `cover_image`
- ❌ `likesCount` → `like_count`
- ❌ `commentsCount` → `comment_count`
- ❌ `createdAt` → `created_at`
- ❌ `updatedAt` → `updated_at`
- ❌ Comment: `parentCommentId` → `parent_id`
- ❌ Comment: `user` → `author`

### 새 필드
- ✨ `excerpt`: 게시글 요약
- ✨ `featured`: 주요 게시글 플래그
- ✨ `view_count`: 조회수
- ✨ `published_at`: 공개 일시

## 롤백 계획

문제 발생 시:

1. **Render에서 이전 버전으로 롤백**:
   - Render Dashboard > blog-api > Manual Deploy > 이전 commit 선택

2. **로컬에서 이전 버전으로 복구**:
   ```bash
   git checkout 3e27fab  # 마이그레이션 이전 커밋
   ```

3. **데이터베이스 복구**:
   - 백업 파일: `backup/database/backup_2025-12-01.md`
   - Prisma 스키마: `backup/prisma/schema.prisma`

## 모니터링

배포 후 확인 사항:
- [ ] 서버 정상 실행 (로그 확인)
- [ ] 데이터베이스 연결 성공
- [ ] GitHub OAuth 로그인 작동
- [ ] Posts API 작동
- [ ] Comments API 작동
- [ ] Categories/Tags API 작동

## 다음 단계

1. Render에서 DATABASE_URL 설정
2. Build Command 업데이트
3. 수동 배포 트리거 또는 자동 배포 대기
4. Shell에서 `npx prisma migrate deploy` 실행
5. 프론트엔드 API 필드명 업데이트
6. 통합 테스트

---

**주의**: 프로덕션 배포 전 반드시 데이터 백업을 확인하세요!
백업 위치: `backup/database/backup_2025-12-01.md`
