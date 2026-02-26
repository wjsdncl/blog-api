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

## 배포 환경

| 항목 | 값 |
|------|-----|
| 호스팅 | Oracle Cloud Instance (Ubuntu) |
| IP | 168.107.6.215 |
| 도메인 | https://api.wjdalswo.xyz |
| 앱 경로 | /var/www/api |
| 프로세스 관리 | PM2 |
| 리버스 프록시 | Nginx |
| SSL | Let's Encrypt (Certbot 자동 갱신) |

## 로컬 개발

### 1. 패키지 설치

```bash
npm install
```

### 2. 환경변수

`.env` 파일을 생성하고 아래 항목을 설정:

```env
DATABASE_URL="postgresql://postgres:qwer1234@localhost:5432/blog_dev?schema=public"
PORT=8000

JWT_SECRET=
JWT_REFRESH_SECRET=

SUPABASE_URL=
SUPABASE_ANON_KEY=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
OAUTH_CALLBACK_URL=http://localhost:8000/auth/oauth/callback

FRONTEND_URL=http://localhost:3000
```

### 3. DB 설정

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db seed          # 시드 데이터 삽입
```

### 4. 실행

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
| `npm start` | 빌드된 JS로 서버 실행 (`dist/app.js`) |
| `npm run build` | TypeScript 빌드 |
| `npm run build:prod` | Prisma generate + TypeScript 빌드 |
| `npm run lint` | ESLint 검사 |
| `npm run db:migrate` | 마이그레이션 적용 |

## 프로젝트 구조

```
blog-api/
├── app.ts              # 서버 엔트리포인트
├── config/             # 서버 설정
├── routes/             # API 라우트
├── services/           # 비즈니스 로직
├── middleware/          # 인증, 에러 핸들링
├── lib/                # Prisma Client, 유틸리티
├── types/              # TypeScript 타입 정의
├── utils/              # 헬퍼 함수
├── docs/               # API 문서 및 배포 가이드
├── prisma/
│   ├── schema.prisma   # DB 스키마
│   ├── migrations/     # 마이그레이션 파일
│   └── seed.ts         # 시드 스크립트
└── dist/               # 빌드 결과물
```

## DB 관리

```bash
npx prisma studio                        # DB GUI
npx prisma migrate dev --name 변경_설명   # 개발 마이그레이션
npx prisma migrate deploy                # 프로덕션 마이그레이션
```

## 서버 운영

서버 SSH 접속, PM2 관리, Nginx 설정, SSL 갱신 등 상세 운영 가이드는 아래 문서 참조:

- [Oracle Cloud 배포 가이드](docs/oracle-cloud-deployment.md)
