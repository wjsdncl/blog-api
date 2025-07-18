# 블로그 API 프로젝트

이 프로젝트는 **Prisma**와 **Express**를 사용하여 사용자, 게시물, 댓글을 관리하는 RESTful API입니다. **JWT**를 활용한 인증 기능을 포함하며, 데이터 검증을 위해 **Superstruct**를 사용합니다.

## 🚀 주요 기능

- **사용자 관리**: GitHub OAuth 로그인, 사용자 정보 조회, 수정, 삭제
- **게시물 관리**: 게시물 생성, 조회, 수정, 삭제, 좋아요 기능
- **댓글 관리**: 댓글 및 대댓글 생성, 조회, 수정, 삭제, 좋아요 기능
- **프로젝트 관리**: 포트폴리오 프로젝트 관리
- **이미지 업로드**: Supabase Storage를 통한 이미지 업로드 및 최적화
- **JWT 인증**: AccessToken(15분)과 RefreshToken(7일)을 통한 보안 강화된 인증

## 🛠️ 사용 기술

### 백엔드 프레임워크 & 라이브러리

- **Node.js**: 서버 사이드 자바스크립트 런타임
- **Express**: 웹 프레임워크
- **Prisma**: 타입 안전한 ORM
- **PostgreSQL**: 관계형 데이터베이스

### 인증 & 보안

- **JWT**: 토큰 기반 인증 시스템
- **Helmet**: 보안 헤더 설정
- **Rate Limiting**: API 요청 제한
- **CORS**: Cross-Origin Resource Sharing 설정

### 데이터 처리 & 검증

- **Superstruct**: 데이터 검증 라이브러리
- **Sharp**: 이미지 처리 및 최적화
- **Multer**: 파일 업로드 처리

### 로깅 & 모니터링

- **Winston**: 구조화된 로깅 시스템
- **Morgan**: HTTP 요청 로깅

### 외부 서비스

- **Supabase**: 이미지 스토리지
- **GitHub OAuth**: 소셜 로그인

## 📁 프로젝트 구조

```
blog-api/
├── config/
│   └── index.js              # 환경 설정 관리
├── lib/
│   ├── prismaClient.js       # Prisma 클라이언트
│   └── structs.js            # 데이터 검증 스키마
├── middleware/
│   ├── auth.js               # 인증 미들웨어
│   └── errorHandler.js       # 에러 처리 미들웨어
├── routes/
│   ├── auth.js               # 인증 관련 라우트
│   ├── categories.js         # 카테고리 관련 라우트
│   ├── comments.js           # 댓글 관련 라우트
│   ├── posts.js              # 게시물 관련 라우트
│   ├── projects.js           # 프로젝트 관련 라우트
│   ├── tags.js               # 태그 관련 라우트
│   ├── upload.js             # 파일 업로드 라우트
│   └── users.js              # 사용자 관련 라우트
├── utils/
│   ├── auth.js               # 인증 유틸리티
│   └── logger.js             # 로깅 유틸리티
├── prisma/
│   ├── schema.prisma         # 데이터베이스 스키마
│   ├── migrations/           # 마이그레이션 파일들
│   ├── seed.js               # 시드 데이터
│   └── mock.js               # 목업 데이터
├── app.js                    # 메인 애플리케이션 파일
└── package.json              # 의존성 관리
```

## 🔧 설치 및 실행

### 1. 프로젝트 클론 및 의존성 설치

```bash
git clone <repository-url>
cd blog-api
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# 데이터베이스
DATABASE_URL="postgresql://..."

# JWT 시크릿
JWT_SECRET="your-jwt-secret"
JWT_REFRESH_SECRET="your-refresh-secret"

# Supabase
SUPABASE_URL="your-supabase-url"
SUPABASE_ANON_KEY="your-supabase-anon-key"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
GITHUB_CALLBACK_URL="http://localhost:8000/auth/github/callback"

# 개발용 GitHub OAuth (선택사항)
GITHUB_CLIENT_ID_DEV="your-dev-github-client-id"
GITHUB_CLIENT_SECRET_DEV="your-dev-github-client-secret"
GITHUB_CALLBACK_URL_DEV="https://localhost:3000/auth/github/callback"

# 기타
NODE_ENV="development"
LOG_LEVEL="info"
```

### 3. 데이터베이스 설정

```bash
# Prisma 마이그레이션 실행
npx prisma migrate dev

# 시드 데이터 삽입 (선택사항)
npx prisma db seed
```

### 4. 서버 실행

```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

## 📚 API 문서

### 🌐 기본 URL

```
http://localhost:3000
```

### 🔐 인증 API (`/auth`)

#### GitHub OAuth 로그인

- **GET** `/auth/github` - GitHub OAuth 로그인 페이지로 리디렉션

  - **Query Parameters**: 없음
  - **Response**: 리디렉션 (302) GitHub OAuth 페이지로 이동

- **GET** `/auth/github/callback` - GitHub OAuth 콜백 처리

  - **Query Parameters**:
    ```typescript
    {
      code: string;        // GitHub OAuth authorization code
      state?: string;      // CSRF protection state
    }
    ```
  - **Response**:
    ```typescript
    {
      success: true;
      data: {
        user: {
          id: string; // UUID
          email: string;
          name: string;
          isOwner: boolean;
          createdAt: string; // ISO 8601
          updatedAt: string; // ISO 8601
        }
        accessToken: string; // JWT (15분 유효)
        refreshToken: string; // JWT (7일 유효)
      }
    }
    ```

#### 로그아웃

- **POST** `/auth/logout` - 로그아웃
  - **Request Body**: 없음
  - **Response**:
    ```typescript
    {
      success: true;
      message: "로그아웃 되었습니다.";
    }
    ```

### 👥 사용자 API (`/users`)

- **GET** `/users/:id` - 특정 사용자 정보 조회

  - **URL Parameters**: `id: string (UUID)`
  - **Headers**: `Authorization: Bearer {token}` (선택적)
  - **Response**:
    ```typescript
    {
      success: true;
      data: {
        id: string;
        name: string;
        email?: string;        // 본인이거나 관리자만 볼 수 있음
        isOwner: boolean;
        createdAt: string;     // ISO 8601
        commentsCount: number; // 작성한 댓글 수
      };
    }
    ```

- **PATCH** `/users/:id` - 사용자 정보 수정

  - **URL Parameters**: `id: string (UUID)`
  - **Headers**: `Authorization: Bearer {token}` (필수)
  - **Request Body**:
    ```typescript
    {
      name?: string;         // 1-20자
    }
    ```
  - **Response**:
    ```typescript
    {
      success: true;
      data: {
        id: string;
        name: string;
        email: string;
        isOwner: boolean;
        updatedAt: string; // ISO 8601
      }
    }
    ```

### 📝 게시물 API (`/posts`)

- **GET** `/posts` - 게시물 목록 조회 (페이지네이션, 필터링, 검색 지원)

  - **Query Parameters**:
    ```typescript
    {
      offset?: string;       // 기본값: "0"
      limit?: string;        // 기본값: "10"
      order?: "newest" | "oldest" | "like";  // 기본값: "newest"
      category?: string;     // 카테고리 슬러그로 필터링
      tag?: string;          // 태그 슬러그로 필터링
      search?: string;       // 제목 초성 검색
    }
    ```
  - **Response**:
    ```typescript
    {
      success: true;
      data: Array<{
        id: number;
        thumbnail: string | null;
        categoryId: number | null;
        title: string;
        content: string;
        likesCount: number;
        views: number;
        createdAt: string; // ISO 8601
        updatedAt: string; // ISO 8601
        slug: string;
        choseongTitle: string; // 초성 제목
        isPrivate: boolean;
        category: {
          name: string;
          slug: string;
        } | null;
        tags: Array<{
          name: string;
          slug: string;
        }>;
        commentsCount: number;
        likesCount: number;
      }>;
      categories: Array<{
        id: number;
        name: string;
        slug: string;
        createdAt: string;
        postsCount: number;
      }>;
      meta: {
        pagination: {
          offset: number;
          limit: number;
          total: number;
        }
      }
    }
    ```

### 💬 댓글 API (`/comments`)

- **GET** `/comments` - 특정 게시물의 댓글 조회

  - **Query Parameters**:
    ```typescript
    {
      postId: string;        // 필수 - 게시물 ID
      offset?: string;       // 기본값: "0" - 페이지네이션 오프셋
      limit?: string;        // 기본값: "10" - 한 번에 가져올 댓글 수
    }
    ```
  - **Response**:
    ```typescript
    {
      success: true;
      data: Array<{
        id: number;
        content: string;
        likesCount: number; // _count.commentLikes에서 변환됨
        isLiked: boolean; // 현재 사용자의 좋아요 여부 (로그인 시에만)
        createdAt: string; // ISO 8601
        updatedAt: string; // ISO 8601
        userId: string;
        postId: number;
        parentCommentId: number | null;
        isEdited: boolean;
        user: {
          id: string;
          name: string;
        };
        replies: Array<{
          id: number;
          content: string;
          likesCount: number; // _count.commentLikes에서 변환됨
          isLiked: boolean; // 현재 사용자의 대댓글 좋아요 여부
          createdAt: string;
          updatedAt: string;
          userId: string;
          postId: number;
          parentCommentId: number;
          isEdited: boolean;
          depth: number; // 댓글 깊이 (0: 최상위, 1: 1차 답글, 2: 2차 답글, ...)
          user: {
            id: string;
            name: string;
          };
          replies: Array<{
            // 중첩된 답글들 (최대 3단계까지)
            id: number;
            content: string;
            likesCount: number;
            isLiked: boolean;
            createdAt: string;
            updatedAt: string;
            userId: string;
            postId: number;
            parentCommentId: number;
            isEdited: boolean;
            depth: number;
            user: {
              id: string;
              name: string;
            };
            replies: Array<any>; // 더 깊은 답글들
          }>;
        }>;
      }>;
      meta: {
        totalCount: number; // 전체 댓글 수
        offset: number;
        limit: number;
      }
    }
    ```

- **POST** `/comments` - 댓글 작성

  - **Headers**: `Authorization: Bearer {token}` (필수)
  - **Request Body**:
    ```typescript
    {
      content: string;       // 1-1000자
      postId: number;
      parentCommentId?: number;  // 대댓글인 경우
    }
    ```
  - **Response**:
    ```typescript
    {
      success: true;
      data: {
        id: number;
        content: string;
        likesCount: number; // _count.commentLikes에서 변환됨 (생성 시 0)
        isLiked: false; // 새로 생성된 댓글이므로 항상 false
        createdAt: string;
        updatedAt: string;
        userId: string;
        postId: number;
        parentCommentId: number | null;
        isEdited: boolean;
        user: {
          id: string;
          name: string;
        }
      }
    }
    ```

- **PATCH** `/comments/:id` - 댓글 수정

  - **URL Parameters**: `id: number`
  - **Headers**: `Authorization: Bearer {token}` (필수)
  - **Request Body**:
    ```typescript
    {
      content: string; // 1-1000자
    }
    ```
  - **Response**:
    ```typescript
    {
      success: true;
      data: {
        id: number;
        content: string;
        likesCount: number; // _count.commentLikes에서 변환됨
        isLiked: boolean; // 현재 사용자의 좋아요 여부
        createdAt: string;
        updatedAt: string;
        userId: string;
        postId: number;
        parentCommentId: number | null;
        isEdited: boolean; // 수정 시 true로 설정
        user: {
          id: string;
          name: string;
        }
      }
    }
    ```

- **DELETE** `/comments/:id` - 댓글 삭제

  - **URL Parameters**: `id: number`
  - **Headers**: `Authorization: Bearer {token}` (필수)
  - **Response**:
    ```typescript
    {
      success: true;
      message: "댓글이 삭제되었습니다.";
    }
    ```

### 📁 카테고리 API (`/categories`)

- **GET** `/categories` - 카테고리 목록 조회

  - **Response**:
    ```typescript
    {
      success: true;
      data: Array<{
        id: number;
        name: string;
        slug: string;
        createdAt: string;
        postsCount: number;
        projectsCount: number;
        totalCount: number;
      }>;
    }
    ```

- **POST** `/categories` - 새 카테고리 생성

  - **Headers**: `Authorization: Bearer {token}` (Owner 권한 필요)
  - **Request Body**:
    ```typescript
    {
      name: string; // 1-50자
    }
    ```
  - **Response**:
    ```typescript
    {
      success: true;
      data: {
        id: number;
        name: string;
        slug: string; // 자동 생성
        createdAt: string;
      }
    }
    ```

- **PATCH** `/categories/:id` - 카테고리 수정

  - **URL Parameters**: `id: number`
  - **Headers**: `Authorization: Bearer {token}` (Owner 권한 필요)
  - **Request Body**:
    ```typescript
    {
      name: string; // 1-50자
    }
    ```
  - **Response**: 카테고리 생성과 동일한 형태

- **DELETE** `/categories/:id` - 카테고리 삭제
  - **URL Parameters**: `id: number`
  - **Headers**: `Authorization: Bearer {token}` (Owner 권한 필요)
  - **Response**: `204 No Content`

### 🏷️ 태그 API (`/tags`)

- **GET** `/tags` - 태그 목록 조회

  - **Response**:
    ```typescript
    {
      success: true;
      data: Array<{
        id: number;
        name: string;
        slug: string;
        createdAt: string; // ISO 8601
        postsCount: number;
        projectsCount: number;
        totalCount: number;
      }>;
    }
    ```

- **POST** `/tags` - 새 태그 생성

  - **Headers**: `Authorization: Bearer {token}` (Owner 권한 필요)
  - **Request Body**:
    ```typescript
    {
      name: string; // 1-50자
    }
    ```
  - **Response**:
    ```typescript
    {
      success: true;
      data: {
        id: number;
        name: string;
        slug: string; // 자동 생성
        createdAt: string;
      }
    }
    ```

- **PATCH** `/tags/:id` - 태그 수정

  - **URL Parameters**: `id: number`
  - **Headers**: `Authorization: Bearer {token}` (Owner 권한 필요)
  - **Request Body**:
    ```typescript
    {
      name: string; // 1-50자
    }
    ```
  - **Response**: 태그 생성과 동일한 형태

- **DELETE** `/tags/:id` - 태그 삭제
  - **URL Parameters**: `id: number`
  - **Headers**: `Authorization: Bearer {token}` (Owner 권한 필요)
  - **Response**: `204 No Content`

### 📁 파일 업로드 API (`/upload`)

- **POST** `/upload` - 이미지 업로드 (Sharp를 통한 자동 최적화)
  - **Headers**:
    ```typescript
    Content-Type: multipart/form-data
    Authorization: Bearer {token}  // 필수
    ```
  - **Request Body (FormData)**:
    ```typescript
    {
      image: File; // 이미지 파일 (최대 5MB)
    }
    ```
  - **Response**:
    ```typescript
    {
      success: true;
      data: {
        url: string; // Supabase Storage URL
        filename: string; // 생성된 파일명
      }
    }
    ```

### 🎯 프로젝트 API (`/projects`)

- **GET** `/projects` - 프로젝트 목록 조회

  - **Query Parameters**:
    ```typescript
    {
      offset?: string;       // 기본값: "0"
      limit?: string;        // 기본값: "10"
      status?: "PLANNING" | "IN_PROGRESS" | "COMPLETED" | "PAUSED" | "ARCHIVED";
      category?: string;     // 카테고리 슬러그로 필터링
      tag?: string;          // 태그 슬러그로 필터링
      isActive?: string;     // "true" | "false"
    }
    ```
  - **Response**:
    ```typescript
    {
      success: true;
      data: Array<{
        id: number;
        title: string;
        slug: string;
        description: string;
        content: string;
        images: string[]; // 이미지 URL 배열
        summary: string[]; // 요약 포인트 배열
        status: "PLANNING" | "IN_PROGRESS" | "COMPLETED" | "PAUSED" | "ARCHIVED";
        categoryId: number | null;
        startDate: string; // ISO 8601
        endDate: string | null; // ISO 8601
        isPersonal: boolean;
        isActive: boolean;
        priority: number;
        createdAt: string; // ISO 8601
        updatedAt: string; // ISO 8601
        category: {
          name: string;
          slug: string;
        } | null;
        tags: Array<{
          name: string;
          slug: string;
        }>;
        techStack: Array<{
          name: string;
        }>;
        links: Array<{
          id: number;
          title: string; // "GitHub", "Demo", "Design" 등
          url: string;
          icon: string | null;
        }>;
      }>;
      meta: {
        pagination: {
          offset: number;
          limit: number;
          total: number;
        }
      }
    }
    ```

- **GET** `/projects/:id` - 특정 프로젝트 조회

  - **URL Parameters**: `id: number`
  - **Response**: 프로젝트 목록 조회의 단일 항목과 동일한 형태

- **POST** `/projects` - 새 프로젝트 생성

  - **Headers**: `Authorization: Bearer {token}` (Owner 권한 필요)
  - **Request Body**:
    ```typescript
    {
      title: string;         // 1-100자
      description: string;
      summary: string[];     // 요약 포인트 배열
      content: string;       // 마크다운 형식
      images: string[];      // 이미지 URL 배열
      startDate: string;     // ISO 8601 format
      endDate?: string;      // ISO 8601 format
      isPersonal?: boolean;  // 기본값: true
      isActive?: boolean;    // 기본값: true
      priority?: number;     // 기본값: 0
      categoryId?: number;
    }
    ```
  - **Response**: 프로젝트 조회와 동일한 형태

- **PATCH** `/projects/:id` - 프로젝트 수정

  - **URL Parameters**: `id: number`
  - **Headers**: `Authorization: Bearer {token}` (Owner 권한 필요)
  - **Request Body**: 프로젝트 생성 요청의 부분 업데이트
  - **Response**: 프로젝트 조회와 동일한 형태

- **DELETE** `/projects/:id` - 프로젝트 삭제
  - **URL Parameters**: `id: number`
  - **Headers**: `Authorization: Bearer {token}` (Owner 권한 필요)
  - **Response**: `204 No Content`

### ❤️ 좋아요 API

#### 게시물 좋아요

- **POST** `/posts/:id/like` - 게시물 좋아요/취소
  - **URL Parameters**: `id: number`
  - **Headers**: `Authorization: Bearer {token}` (필수)
  - **Response**:
    ```typescript
    {
      success: true;
      data: {
        isLiked: boolean; // 현재 좋아요 상태
        likesCount: number; // 총 좋아요 수
      }
    }
    ```

#### 댓글 좋아요

- **POST** `/comments/:id/like` - 댓글 좋아요/취소
  - **URL Parameters**: `id: number`
  - **Headers**: `Authorization: Bearer {token}` (필수)
  - **Response**:
    ```typescript
    {
      success: true;
      data: {
        comment: {
          id: number;
          content: string;
          likesCount: number; // 업데이트된 좋아요 수
        }
        isLiked: boolean; // 현재 사용자의 좋아요 상태 (true: 좋아요, false: 취소)
      }
    }
    ```

### 🏥 시스템 API

- **GET** `/health` - 서버 상태 확인

  - **Response**:

    ```typescript
    {
      success: true;
      message: "Server is healthy";
      timestamp: string; // ISO 8601
      uptime: number; // 서버 가동 시간 (초)
    }
    ```

    {
    success: true,
    data: {
    id: string,
    email: string,
    name: string,
    isOwner: boolean,
    createdAt: string,
    updatedAt: string
    }
    }

    ```

    ```

- **DELETE** `/users/:id` - 사용자 삭제
  - **Headers**: `Authorization: Bearer {token}`
  - **URL Parameters**: `id: string`
  - **Response**: `204 No Content`

### 📝 게시물 API (`/posts`)

- **GET** `/posts` - 게시물 목록 조회 (페이지네이션, 필터링, 검색 지원)

  - **Query Parameters**:
    ```typescript
    {
      offset?: number,
      limit?: number,
      order?: 'newest' | 'oldest' | 'like',
      category?: string,
      tag?: string,
      search?: string
    }
    ```
  - **Response**:
    ```typescript
    {
      success: true,
      data: Array<{
        id: number,
        title: string,
        content: string,
        slug: string,
        thumbnail?: string,
        isPrivate: boolean,
        likesCount: number,
        createdAt: string,
        updatedAt: string,
        category?: {
          name: string,
          slug: string
        },
        tags: Array<{
          name: string,
          slug: string
        }>,
        commentsCount: number,
        likesCount: number
      }>,
      categories: Array<{
        id: number,
        name: string,
        slug: string,
        createdAt: string,
        postsCount: number
      }>,
      meta: {
        pagination: {
          offset: number,
          limit: number,
          total: number
        }
      }
    }
    ```

- **GET** `/posts/:slug` - 특정 게시물 조회

  - **URL Parameters**: `slug: string`
  - **Response**:
    ```typescript
    {
      success: true,
      data: {
        id: number,
        title: string,
        content: string,
        slug: string,
        thumbnail?: string,
        isPrivate: boolean,
        likesCount: number,
        isLiked: boolean,
        createdAt: string,
        updatedAt: string,
        category?: {
          id: number,
          name: string,
          slug: string
        },
        tags: Array<{
          id: number,
          name: string,
          slug: string
        }>,
        comments: Array<{
          id: number,
          content: string,
          likesCount: number,
          createdAt: string,
          user: {
            email: string,
            name: string
          },
          replies: Array<Comment>
        }>
      }
    }
    ```

- **POST** `/posts` - 새 게시물 작성

  - **Headers**: `Authorization: Bearer {token}` (Owner 권한 필요)
  - **Request Body**:
    ```typescript
    {
      title: string,
      content: string,
      thumbnail?: string,
      categoryId?: number,
      tags?: string[],
      isPrivate?: boolean
    }
    ```
  - **Response**:
    ```typescript
    {
      success: true,
      data: {
        id: number,
        title: string,
        content: string,
        slug: string,
        thumbnail?: string,
        isPrivate: boolean,
        likesCount: number,
        createdAt: string,
        updatedAt: string,
        category?: Category,
        tags: Array<Tag>
      }
    }
    ```

- **PATCH** `/posts/:id` - 게시물 수정

  - **Headers**: `Authorization: Bearer {token}` (Owner 권한 필요)
  - **URL Parameters**: `id: number`
  - **Request Body**: 동일한 형태의 부분 업데이트
  - **Response**: 동일한 형태

- **DELETE** `/posts/:id` - 게시물 삭제

  - **Headers**: `Authorization: Bearer {token}` (Owner 권한 필요)
  - **URL Parameters**: `id: number`
  - **Response**: `204 No Content`

- **POST** `/posts/:id/like` - 게시물 좋아요/취소
  - **Headers**: `Authorization: Bearer {token}`
  - **URL Parameters**: `id: number`
  - **Response**:
    ```typescript
    {
      success: true,
      data: {
        post: {
          id: number,
          title: string,
          likesCount: number
        },
        isLiked: boolean
      }
    }
    ```

### 💬 댓글 API (`/comments`)

- **GET** `/comments` - 모든 댓글 조회

  - **Query Parameters**:
    ```typescript
    {
      offset?: number,
      limit?: number
    }
    ```
  - **Response**:
    ```typescript
    {
      success: true,
      data: Array<{
        id: number,
        content: string,
        likesCount: number,
        createdAt: string,
        post: {
          title: string
        },
        user: {
          email: string,
          name: string
        },
        replies: Array<Comment>
      }>,
      meta: {
        pagination: {
          offset: number,
          limit: number
        }
      }
    }
    ```

- **GET** `/comments/:postId` - 특정 게시물의 댓글 조회

  - **URL Parameters**: `postId: number`
  - **Query Parameters**:
    ```typescript
    {
      offset?: number,
      limit?: number
    }
    ```
  - **Response**:
    ```typescript
    {
      success: true,
      data: {
        totalComments: number,
        parentComments: number,
        comments: Array<{
          id: number,
          content: string,
          likesCount: number,
          isLiked: boolean,
          createdAt: string,
          user: {
            email: string,
            name: string
          },
          replies: Array<Comment>
        }>
      },
      meta: {
        pagination: {
          offset: number,
          limit: number
        }
      }
    }
    ```

- **POST** `/comments` - 댓글 작성

  - **Headers**: `Authorization: Bearer {token}`
  - **Request Body**:
    ```typescript
    {
      content: string,
      postId: number,
      parentCommentId?: number
    }
    ```
  - **Response**:
    ```typescript
    {
      success: true,
      data: {
        id: number,
        content: string,
        likesCount: number,
        createdAt: string,
        user: {
          email: string,
          name: string
        }
      }
    }
    ```

- **PATCH** `/comments/:id` - 댓글 수정

  - **Headers**: `Authorization: Bearer {token}`
  - **URL Parameters**: `id: number`
  - **Request Body**:
    ```typescript
    {
      content: string;
    }
    ```
  - **Response**: 동일한 형태

- **DELETE** `/comments/:id` - 댓글 삭제

  - **Headers**: `Authorization: Bearer {token}`
  - **URL Parameters**: `id: number`
  - **Response**: `204 No Content`

- **POST** `/comments/:id/like` - 댓글 좋아요/취소
  - **Headers**: `Authorization: Bearer {token}`
  - **URL Parameters**: `id: number`
  - **Response**:
    ```typescript
    {
      success: true,
      data: {
        comment: {
          id: number,
          likesCount: number
        },
        isLiked: boolean
      }
    }
    ```

### 🎯 프로젝트 API (`/projects`)

- **GET** `/projects` - 프로젝트 목록 조회

  - **Query Parameters**:
    ```typescript
    {
      category?: string,
      tag?: string
    }
    ```
  - **Response**:
    ```typescript
    {
      success: true,
      data: Array<{
        id: number,
        title: string,
        description: string,
        summary: string[],
        content: string,
        images: string[],
        slug: string,
        startDate: string,
        endDate?: string,
        isPersonal: boolean,
        isActive: boolean,
        priority: number,
        createdAt: string,
        updatedAt: string,
        category?: Category,
        tags: Array<Tag>,
        techStack: Array<TechStack>
      }>
    }
    ```

## 🔒 보안 기능

### 인증 & 인가

- JWT 기반 인증 (AccessToken 15분, RefreshToken 7일)
- 토큰 자동 갱신 시스템
- 권한 기반 접근 제어

### 보안 미들웨어

- **Helmet**: 보안 헤더 설정
- **Rate Limiting**: API 요청 제한 (일반: 100req/15min, 인증: 10req/15min)
- **CORS**: 허용된 도메인만 접근 가능

### 데이터 보안

- 입력 데이터 검증 (Superstruct)
- SQL Injection 방지 (Prisma ORM)
- XSS 공격 방지

## 📊 로깅 & 모니터링

### Winston 로그 시스템

- **구조화된 JSON 로깅**
- **로그 레벨**: error, warn, info, debug
- **로그 파일 관리**: 자동 로테이션 (5MB, 5개 파일)
- **개발환경**: 콘솔 출력 + 파일 저장
- **프로덕션**: 파일 저장만

### 로그 종류

- **HTTP 요청 로그**: 모든 API 요청/응답 기록
- **인증 로그**: 로그인, 토큰 갱신 등
- **에러 로그**: 모든 에러 상세 기록
- **비즈니스 로그**: 중요 비즈니스 로직 실행 기록

## 🎯 성능 최적화

### 데이터베이스 최적화

- **인덱스 최적화**: 자주 사용되는 쿼리에 대한 복합 인덱스 설정
- **N+1 쿼리 방지**: include를 통한 관계 데이터 한번에 조회
- **페이지네이션**: 대용량 데이터 처리를 위한 효율적인 페이징
- **조건부 쿼리**: 로그인 사용자에게만 좋아요 정보를 조회하여 불필요한 쿼리 방지

### 이미지 처리 최적화

- **Sharp**: 고성능 이미지 처리 라이브러리
- **자동 리사이징**: 최대 1920x1080 해상도로 제한
- **포맷 최적화**: JPEG 85% 품질, Progressive 인코딩

### 캐싱 전략

- **HTTP 헤더**: 정적 리소스 캐싱
- **Supabase CDN**: 이미지 전역 배포

## 🚀 배포 및 운영

### 환경 구성

- **개발**: `NODE_ENV=development`
- **프로덕션**: `NODE_ENV=production`

### Health Check

- **GET** `/health` - 서버 상태 확인 엔드포인트

### Graceful Shutdown

- SIGTERM/SIGINT 시그널 처리
- 진행 중인 요청 완료 후 종료

## 📋 API 응답 형식

### 성공 응답

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "pagination": {
      "offset": 0,
      "limit": 10,
      "total": 100
    }
  }
}
```

### 에러 응답

```json
{
  "success": false,
  "error": "에러 메시지"
}
```

## 🔧 개발 도구

### 스크립트

```bash
npm run dev           # 개발 서버 실행 (nodemon)
npm start             # 프로덕션 서버 실행
npm run db:reset:safe # 안전한 데이터베이스 리셋
npm run db:backup     # 데이터베이스 백업 안내
npm run format:prisma # Prisma 스키마 포맷팅
```

### 데이터베이스

```bash
npx prisma studio     # Prisma Studio 실행
npx prisma migrate    # 마이그레이션 실행
npx prisma generate   # 클라이언트 재생성
npx prisma db seed    # 시드 데이터 삽입
```

## 📊 현재 시스템 상태 (2025년 7월 13일 기준)

### 🚀 서버 운영 현황

- **서버 상태**: ✅ 정상 운영 중 (`localhost:3000`)
- **런타임**: TypeScript 5.3.3 + tsx watch 모드
- **데이터베이스**: PostgreSQL (Prisma 6.11.1)
- **환경**: 개발 환경 (`NODE_ENV=development`)

### 📈 데이터 현황

성공적으로 마이그레이션된 데이터:

| 구분         | 개수 | 상태    | 비고                          |
| ------------ | ---- | ------- | ----------------------------- |
| **포스트**   | 25개 | ✅ 정상 | 블로그 개발 일지 시리즈 포함  |
| **사용자**   | 15개 | ✅ 정상 | GitHub OAuth 연동 가능        |
| **카테고리** | 1개  | ✅ 정상 | "블로그" 카테고리             |
| **태그**     | 33개 | ✅ 정상 | React, Next.js, TypeScript 등 |
| **댓글**     | 34개 | ✅ 정상 | 계층 구조 및 대댓글 포함      |

### 🔗 API 엔드포인트 상태

모든 API 엔드포인트가 정상 동작 중:

- ✅ `GET /posts` - 포스트 목록 조회 (페이지네이션, 필터링, 검색)
- ✅ `GET /categories` - 카테고리 목록 조회
- ✅ `GET /tags` - 태그 목록 조회
- ✅ `GET /comments?postId=X` - 댓글 조회
- ✅ `GET /health` - 서버 상태 확인
- ✅ GitHub OAuth 인증 플로우 구현
- ✅ JWT 토큰 기반 인증 시스템
- ✅ `GET /projects` - 프로젝트 목록 조회 (techStack, links 포함)
- ✅ `GET /projects/:id` - 특정 프로젝트 조회 (techStack, links 포함)
- ✅ `POST /projects` - 프로젝트 생성 (Owner 권한)
- ✅ `PATCH /projects/:id` - 프로젝트 수정 (Owner 권한)
- ✅ 파일 업로드 (이미지 최적화)
- ✅ 완전한 프로젝트 관리 API (CRUD 작업, 기술 스택, 링크 정보 포함)

### 🎯 주요 성과

1. **완벽한 데이터 마이그레이션**:

   - 기존 `blog_9btt_rgor` PostgreSQL 덤프 → 현재 Prisma 스키마
   - String 카테고리 → ID 기반 관계로 변환
   - String[] 태그 → Many-to-Many 관계로 변환

2. **TypeScript 완전 통합**:

   - 모든 API가 타입 안전성 보장
   - Zod를 통한 런타임 검증
   - Prisma를 통한 타입 안전한 데이터베이스 액세스

3. **완전한 프로젝트 관리 시스템**:

   - 포트폴리오 프로젝트 CRUD 작업 완료
   - 기술 스택 (`techStack`) 정보 포함
   - 프로젝트 링크 (`links`) 정보 포함 (GitHub, Demo, Design 등)
   - 우선순위 기반 정렬 및 필터링

4. **프로덕션 준비 완료**:
   - 보안 미들웨어 (Helmet, Rate Limiting, CORS)
   - 구조화된 로깅 시스템 (Winston)
   - 에러 핸들링 및 Graceful Shutdown

### 🔧 기술 스택 상세

```typescript
// 현재 운영 중인 기술 스택
{
  "backend": {
    "runtime": "Node.js + TypeScript 5.3.3",
    "framework": "Express.js 4.21.2",
    "database": "PostgreSQL + Prisma 6.11.1",
    "validation": "Zod 3.22.4",
    "authentication": "JWT + GitHub OAuth",
    "logging": "Winston 3.17.0",
    "imageProcessing": "Sharp 0.33.5"
  },
  "infrastructure": {
    "storage": "Supabase Storage",
    "deployment": "로컬 개발 서버",
    "monitoring": "Winston 로그 시스템"
  }
}
```
