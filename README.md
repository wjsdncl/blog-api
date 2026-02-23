# Blog API

Fastify + Prisma + PostgreSQL 기반 블로그 백엔드 API.

## 기술 스택

- **Runtime**: Node.js >= 22.12.0
- **Framework**: Fastify 5
- **ORM**: Prisma 7 (`@prisma/adapter-pg`)
- **Database**: PostgreSQL
- **Language**: TypeScript 5.9
- **Auth**: JWT + GitHub OAuth
- **Storage**: Supabase (이미지)

## 설정

### 1. 패키지 설치

```bash
npm install
```

### 2. 환경변수

`.env` 파일을 생성하고 아래 항목을 설정:

```env
DATABASE_URL="postgresql://postgres:qwer1234@localhost:5432/blog_dev?schema=public"
PORT=3000

# Supabase (이미지 업로드)
SUPABASE_URL=
SUPABASE_ANON_KEY=

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=

# JWT
JWT_SECRET=
JWT_REFRESH_SECRET=

CLIENT_URL=http://localhost:3000
```

### 3. DB 설정

```bash
# Prisma Client 생성
npx prisma generate

# 마이그레이션 적용
npx prisma migrate deploy

# 시드 데이터 삽입
npx prisma db seed
```

## 실행

```bash
# 개발 (Hot-reload)
npm run dev

# 프로덕션
npm run build:prod
npm start
```

## 주요 스크립트

| 스크립트 | 설명 |
|---|---|
| `npm run dev` | tsx watch로 개발 서버 실행 |
| `npm start` | 빌드된 JS로 서버 실행 |
| `npm run build:prod` | Prisma generate + TypeScript 빌드 |
| `npm run lint` | ESLint 검사 |
| `npm run db:migrate` | 마이그레이션 적용 |

## 프로젝트 구조

```
blog-api/
├── app.ts              # 서버 엔트리포인트
├── routes/             # API 라우트
├── services/           # 비즈니스 로직
├── middleware/          # 인증, 에러 핸들링 등
├── lib/                # Prisma Client, 유틸리티
├── types/              # TypeScript 타입 정의
├── prisma/
│   ├── schema.prisma   # DB 스키마
│   ├── migrations/     # 마이그레이션 파일
│   └── seed.ts         # 시드 스크립트
└── config/             # 서버 설정
```

## DB 관리

```bash
# Prisma Studio (DB GUI)
npx prisma studio

# 스키마 변경 후
npx prisma migrate dev --name 변경_설명

# 프로덕션 마이그레이션
npx prisma migrate deploy
```
