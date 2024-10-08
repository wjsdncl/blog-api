# 블로그 API 프로젝트

이 프로젝트는 **Prisma**와 **Express**를 사용하여 사용자, 게시물, 댓글을 관리하는 RESTful API입니다. **JWT**를 활용한 인증 기능을 포함하며, 데이터 검증을 위해 **Superstruct**를 사용합니다.

## 주요 기능

- **사용자 관리**: 회원가입, 로그인, 사용자 정보 조회, 수정, 삭제
- **게시물 관리**: 게시물 생성, 조회, 수정, 삭제
- **댓글 관리**: 댓글 및 대댓글 생성, 조회, 수정, 삭제
- **JWT 인증**: AccessToken과 RefreshToken을 통한 인증 및 토큰 갱신 기능

## 사용 기술

- **Node.js**: 서버 사이드 자바스크립트 런타임
- **Express**: 간단하고 유연한 웹 프레임워크
- **Prisma**: 타입 안전한 ORM으로 데이터베이스와 상호 작용
- **PostgreSQL**: 관계형 데이터베이스
- **Superstruct**: 데이터 검증을 위한 라이브러리
- **bcrypt**: 비밀번호 해싱을 위한 라이브러리
- **jsonwebtoken**: JWT 토큰 생성 및 검증
- **dotenv**: 환경 변수 관리

## API 문서

### Auth API

- **회원가입**:

  - `POST http://localhost:8000/auth/signup`
  - 요청 바디:
    ```json
    {
      "email": "testuser@example.com",
      "name": "테스트유저",
      "password": "password123"
    }
    ```

- **로그인**:

  - `POST http://localhost:8000/auth/login`
  - 요청 바디:
    ```json
    {
      "email": "testuser@example.com",
      "password": "password123"
    }
    ```

- **토큰 갱신**:
  - `POST http://localhost:8000/auth/refresh`
  - 요청 바디:
    ```json
    {
      "refreshToken": "yourToken"
    }
    ```

### 사용자 API

- **모든 사용자 조회**:
  - `GET http://localhost:8000/users`
  - 헤더: `Authorization: Bearer yourToken`
- **내 정보 조회**:

  - `GET http://localhost:8000/users/me`
  - 헤더: `Authorization: Bearer yourToken`

- **사용자 정보 수정**:

  - `PATCH http://localhost:8000/users/:id`
  - 요청 바디:
    ```json
    {
      "name": "수정된 이름"
    }
    ```
  - 헤더: `Authorization: Bearer yourToken`

- **사용자 삭제**:
  - `DELETE http://localhost:8000/users/:id`
  - 헤더: `Authorization: Bearer yourToken`

### 게시물 API

- **모든 게시물 조회**:

  - `GET http://localhost:8000/posts`

- **특정 게시물 조회**:

  - `GET http://localhost:8000/posts/:slug`

- **새로운 게시물 생성**:

  - `POST http://localhost:8000/posts`
  - 요청 바디:
    ```json
    {
      "title": "새로운 게시물 제목",
      "content": "게시물 내용입니다.",
      "userId": "유저ID",
      "tags": ["tag1", "tag2"]
    }
    ```
  - 헤더: `Authorization: Bearer yourToken`

- **게시물 수정**:

  - `PATCH http://localhost:8000/posts/:id`
  - 요청 바디:
    ```json
    {
      "title": "수정된 제목"
    }
    ```
  - 헤더: `Authorization: Bearer yourToken`

- **게시물 삭제**:
  - `DELETE http://localhost:8000/posts/:id`
  - 헤더: `Authorization: Bearer yourToken`

### 댓글 API

- **모든 댓글 조회**:

  - `GET http://localhost:8000/comments`

- **특정 게시물의 댓글 조회**:

  - `GET http://localhost:8000/comments/:slug`

- **새로운 댓글 작성**:

  - `POST http://localhost:8000/comments`
  - 요청 바디:
    ```json
    {
      "content": "이것은 댓글입니다.",
      "userId": "유저ID",
      "postId": 1
    }
    ```
  - 헤더: `Authorization: Bearer yourToken`

- **댓글 수정**:

  - `PATCH http://localhost:8000/comments/:id`
  - 요청 바디:
    ```json
    {
      "content": "수정된 댓글 내용입니다."
    }
    ```
  - 헤더: `Authorization: Bearer yourToken`

- **댓글 삭제**:
  - `DELETE http://localhost:8000/comments/:id`
  - 헤더: `Authorization: Bearer yourToken`

## 기타 사항

- API 문서와 각 엔드포인트에 대한 자세한 설명은 코드 주석과 함께 제공됩니다.
- 데이터베이스 설정 및 마이그레이션 관련 문제는 Prisma 공식 문서를 참조하세요: [Prisma Docs](https://www.prisma.io/docs)
