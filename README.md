# Prisma와 Express를 사용한 블로그 API

이 프로젝트는 Prisma와 PostgreSQL 데이터베이스, Express를 사용하여 사용자, 게시물, 댓글을 관리할 수 있는 RESTful API를 제공합니다.

## 주요 기능

- **사용자 관리**: 사용자 생성, 조회, 수정 및 삭제 기능을 제공합니다.
- **게시물 관리**: 게시물 생성, 조회, 수정 및 삭제 기능을 제공합니다. 게시물은 선택적으로 커버 이미지, 카테고리, 태그를 가질 수 있습니다.
- **댓글 관리**: 댓글 생성, 조회, 수정 및 삭제 기능을 제공합니다. 대댓글(답글) 기능도 포함됩니다.
- **데이터 검증**: `superstruct`를 사용하여 입력 데이터를 검증하고 데이터 무결성을 보장합니다.

## 사용 기술

- **Node.js**: 자바스크립트 런타임 환경.
- **Express**: 빠르고 간결한 Node.js 웹 프레임워크.
- **Prisma**: 차세대 ORM(Object-Relational Mapping)으로, 데이터베이스 접근을 간편하게 해줍니다.
- **PostgreSQL**: 관계형 데이터베이스로 데이터 저장에 사용됩니다.
- **Superstruct**: 자바스크립트에서 데이터 검증 및 구조화를 위한 라이브러리.
- **dotenv**: `.env` 파일에서 환경 변수를 로드하는 모듈.

## 사전 준비 사항

- Node.js (v14 이상)
- PostgreSQL
- npm (Node 패키지 매니저)

## 시작하기

### 1. 저장소 클론하기

```bash
git clone https://github.com/your-username/blog-api.git
cd blog-api
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

`.env` 파일을 프로젝트 루트 디렉토리에 생성하고, 다음과 같이 설정합니다:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME
PORT=3000
```

- `DATABASE_URL`: PostgreSQL 데이터베이스 URL을 입력합니다.
- `PORT`: 서버가 실행될 포트를 지정합니다. 기본값은 3000입니다.

### 4. Prisma 설정 및 데이터베이스 마이그레이션

Prisma를 설정하고 데이터베이스를 마이그레이션합니다.

```bash
npx prisma migrate dev --name init
```

### 5. 서버 실행

서버를 실행하여 API를 테스트할 수 있습니다.

```bash
npm run dev
```

## API 문서

### 사용자 API

- **GET 모든 사용자**:

  - `GET http://localhost:3000/users`

- **GET 특정 사용자**:

  - `GET http://localhost:3000/users/:id`

- **POST 새로운 사용자 생성**:

  - `POST http://localhost:3000/users`
  - 요청 바디:
    ```json
    {
      "email": "example@naver.com",
      "name": "홍길동"
    }
    ```

- **PATCH 사용자 정보 수정**:

  - `PATCH http://localhost:3000/users/:id`
  - 요청 바디:
    ```json
    {
      "name": "수정된 이름"
    }
    ```

- **DELETE 사용자 삭제**:
  - `DELETE http://localhost:3000/users/:id`

### 게시물 API

- **GET 모든 게시물**:

  - `GET http://localhost:3000/posts`

- **GET 특정 게시물**:

  - `GET http://localhost:3000/posts/:slug`

- **POST 새로운 게시물 생성**:

  - `POST http://localhost:3000/posts`
  - 요청 바디:
    ```json
    {
      "title": "새로운 게시물 제목",
      "content": "게시물 내용입니다.",
      "userId": "사용자 UUID"
    }
    ```

- **PATCH 게시물 수정**:

  - `PATCH http://localhost:3000/posts/:id`
  - 요청 바디:
    ```json
    {
      "title": "수정된 제목"
    }
    ```

- **DELETE 게시물 삭제**:
  - `DELETE http://localhost:3000/posts/:id`

### 댓글 API

- **GET 모든 댓글**:

  - `GET http://localhost:3000/comments`

- **GET 특정 게시물의 댓글**:

  - `GET http://localhost:3000/comments/:slug`

- **POST 새로운 댓글 작성**:

  - `POST http://localhost:3000/comments`
  - 요청 바디:
    ```json
    {
      "content": "이것은 댓글입니다.",
      "userId": "사용자 UUID",
      "postId": 1
    }
    ```

- **PATCH 댓글 수정**:

  - `PATCH http://localhost:3000/comments/:id`
  - 요청 바디:
    ```json
    {
      "content": "수정된 댓글 내용입니다."
    }
    ```

- **DELETE 댓글 삭제**:
  - `DELETE http://localhost:3000/comments/:id`

## 기타 사항

- API 문서와 각 엔드포인트에 대한 자세한 설명은 코드 주석과 함께 제공됩니다.
- 데이터베이스 설정 및 마이그레이션 관련 문제는 Prisma 공식 문서를 참조하세요: [Prisma Docs](https://www.prisma.io/docs)

## 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

```

이 README 파일은 프로젝트의 설정과 사용 방법을 상세히 안내하며, 주요 API에 대한 설명을 포함하고 있습니다. 필요한 수정 사항이 있거나 추가 정보가 필요하면 알려주세요!
```
