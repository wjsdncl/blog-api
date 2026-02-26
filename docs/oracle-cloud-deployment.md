# Oracle Cloud 배포 가이드

> 작성일: 2026-02-26
> 서버: Oracle Cloud Instance (Ubuntu)
> IP: 168.107.6.215
> 도메인: api.wjdalswo.xyz
> 앱 경로: /var/www/api

---

## 1. 전체 작업 내용

### 1단계: 인프라 기초

#### 1-1. Node.js 22 설치

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

#### 1-2. PostgreSQL 설치 및 DB 생성

```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

DB/유저 생성:

```bash
sudo -u postgres psql
```

```sql
CREATE USER blog_user WITH PASSWORD '비밀번호';
CREATE DATABASE blog_prod OWNER blog_user;

\c blog_prod
CREATE SCHEMA IF NOT EXISTS auth;
GRANT ALL ON SCHEMA public TO blog_user;
GRANT ALL ON SCHEMA auth TO blog_user;
\q
```

> Prisma 스키마가 `public`, `auth` 두 개의 schema를 사용하므로 반드시 auth 스키마 생성 및 권한 부여 필요.

#### 1-3. `.env` 파일 생성

경로: `/var/www/api/.env`

```env
NODE_ENV=production
PORT=8000

DATABASE_URL="postgresql://blog_user:비밀번호@localhost:5432/blog_prod?schema=public"

JWT_SECRET=openssl_rand_hex_32로_생성
JWT_REFRESH_SECRET=openssl_rand_hex_32로_생성

SUPABASE_URL=https://zrkselfyyqkkqcmxhjlt.supabase.co
SUPABASE_ANON_KEY=기존_키_값

GITHUB_CLIENT_ID=프로덕션용_클라이언트_ID
GITHUB_CLIENT_SECRET=프로덕션용_클라이언트_시크릿
OAUTH_CALLBACK_URL=https://api.wjdalswo.xyz/auth/oauth/callback

FRONTEND_URL=https://wjdalswo.xyz

SWAGGER_ENABLED=false
LOG_LEVEL=info
```

JWT 시크릿 생성:

```bash
openssl rand -hex 32  # 두 번 실행하여 각각 사용
```

필수 환경변수 (없으면 서버 시작 실패):
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

#### 1-4. 의존성 설치 및 빌드

```bash
cd /var/www/api
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build   # tsc && tsc-alias
node dist/app.js  # 테스트 후 Ctrl+C
```

---

### 2단계: 서버 실행 및 외부 접근

#### 2-1. PM2 프로세스 관리

```bash
sudo npm install -g pm2

cd /var/www/api
pm2 start dist/app.js --name blog-api
pm2 status
pm2 logs blog-api --lines 10

# 서버 재부팅 시 자동 시작
pm2 startup    # 출력되는 sudo 명령어 복사 실행
pm2 save
```

#### 2-2. 방화벽 설정

OS 레벨 (iptables):

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Oracle Cloud 콘솔 (VCN Security List):

1. Networking > Virtual Cloud Networks > VCN 선택
2. Subnets > 서브넷 선택
3. Security Lists > Ingress Rules에 추가:

| Source CIDR  | Protocol | Dest Port | 설명  |
| ------------ | -------- | --------- | ----- |
| `0.0.0.0/0`  | TCP      | 80        | HTTP  |
| `0.0.0.0/0`  | TCP      | 443       | HTTPS |

#### 2-3. Nginx 리버스 프록시

```bash
sudo apt-get install -y nginx
sudo systemctl enable nginx
```

설정 파일: `/etc/nginx/sites-available/blog-api`

```nginx
server {
    listen 80;
    server_name api.wjdalswo.xyz;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

활성화:

```bash
sudo ln -s /etc/nginx/sites-available/blog-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

### 3단계: SSL 인증서 (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.wjdalswo.xyz

# 자동 갱신 테스트
sudo certbot renew --dry-run
```

Certbot이 Nginx 설정에 SSL 블록과 HTTP→HTTPS 리다이렉트를 자동 추가함.

- 인증서 경로: `/etc/letsencrypt/live/api.wjdalswo.xyz/fullchain.pem`
- 키 경로: `/etc/letsencrypt/live/api.wjdalswo.xyz/privkey.pem`
- 만료일: 2026-05-27 (90일, 자동 갱신 등록됨)

---

### 4단계: 프로덕션 최적화

#### 4-1. 프론트엔드 API URL 변경 (완료)

Render → Oracle Cloud로 `BACKEND_URL` 변경:

| 파일 | 변경 내용 |
|------|----------|
| `blog/.env` | `BACKEND_URL=https://api.wjdalswo.xyz` |
| `blog/.env.local` | `BACKEND_URL=https://api.wjdalswo.xyz` |
| `blog/src/services/instance/common.api.ts` | fallback URL → `https://api.wjdalswo.xyz` |

#### 4-2. swap 메모리 추가 (완료)

RAM 954MB + Swap 2GB 구성. 메모리 부족(OOM Kill) 방지.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

#### 4-3. GitHub OAuth 앱 설정

GitHub > Settings > Developer settings > OAuth Apps:
- **Homepage URL**: `https://wjdalswo.xyz`
- **Authorization callback URL**: `https://api.wjdalswo.xyz/auth/oauth/callback`

#### 4-4. 기타

- DB 시드 필요 시: `cd /var/www/api && npx prisma db seed`
- Swagger 프로덕션 비활성화: `SWAGGER_ENABLED=false` (`.env`에 설정 완료)

---

## 2-1. 작업 중 발생한 문제 및 해결

### 외부에서 접속 불가 (port 80 연결 거부)

- **증상**: `curl http://api.wjdalswo.xyz/health` → `Failed to connect ... port 80`
- **원인**: Oracle Cloud VCN Security List에 80, 443 포트 Ingress Rule 미등록
- **해결**: Oracle Cloud 콘솔 > VCN > Subnets > Security Lists > Ingress Rules에 80, 443 TCP 규칙 추가
- **참고**: 오라클 클라우드는 OS 방화벽(iptables)과 VCN Security List 두 곳 모두 열어야 함. 한쪽만 열면 접속 불가.

---

## 2-2. 추가 예상 문제 및 해결 방안

### PM2 프로세스가 재부팅 후 실행되지 않음

- **원인**: `pm2 startup` 실행 후 출력된 sudo 명령어를 실행하지 않았거나 `pm2 save`를 하지 않음
- **해결**:
  ```bash
  pm2 startup        # 출력되는 sudo 명령어 복사 실행
  pm2 save           # 현재 프로세스 목록 저장
  sudo reboot        # 재부팅 후 pm2 status로 확인
  ```

### SSL 인증서 만료 (90일)

- **원인**: Let's Encrypt 인증서는 90일 유효. 자동 갱신 타이머가 비활성화된 경우
- **확인**:
  ```bash
  sudo systemctl status certbot.timer
  sudo certbot renew --dry-run
  ```
- **수동 갱신**:
  ```bash
  sudo certbot renew
  sudo systemctl restart nginx
  ```

### OAuth 로그인 실패

- **원인**: GitHub OAuth 앱의 callback URL이 프로덕션 도메인과 불일치
- **해결**: GitHub > Settings > Developer settings > OAuth Apps에서 callback URL을 `https://api.wjdalswo.xyz/auth/oauth/callback`으로 변경
- **확인**: `.env`의 `OAUTH_CALLBACK_URL` 값과 GitHub 설정이 일치하는지 확인

### 쿠키가 전달되지 않음

- **원인**: 프로덕션에서 `secure: true` 설정이므로 HTTPS 필수. HTTP로 접근하면 쿠키 설정 안 됨
- **해결**: SSL 인증서 설정 완료 후 HTTPS로만 접근. 프론트엔드도 HTTPS 필요

### Prisma 마이그레이션 실패

- **원인**: DB 유저 권한 부족 또는 auth 스키마 미생성
- **해결**:
  ```bash
  sudo -u postgres psql -d blog_prod
  CREATE SCHEMA IF NOT EXISTS auth;
  GRANT ALL ON SCHEMA public TO blog_user;
  GRANT ALL ON SCHEMA auth TO blog_user;
  \q
  npx prisma migrate deploy
  ```

### 디스크 용량 부족

- **원인**: 오라클 클라우드 Free Tier 기본 디스크가 작음. 로그 파일 누적
- **확인 및 정리**:
  ```bash
  df -h
  pm2 flush              # PM2 로그 정리
  sudo journalctl --vacuum-time=7d   # 시스템 로그 7일만 유지
  ```

### 메모리 부족 (OOM Kill)

- **원인**: Free Tier 인스턴스는 RAM 1GB. Node.js + PostgreSQL + Nginx 동시 실행 시 부족할 수 있음
- **해결**: swap 메모리 추가
  ```bash
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  free -h   # 확인
  ```

---

## 3. 서버 확인, 실행, 점검 방법

### SSH 접속

```bash
ssh -i "C:\Users\wlke2\.ssh\ssh-key-2026-02-24.key" ubuntu@168.107.6.215
```

### 서비스 상태 확인

```bash
# 전체 상태 한눈에 보기
pm2 status                          # Node.js 앱 상태
sudo systemctl status nginx         # Nginx 상태
sudo systemctl status postgresql    # PostgreSQL 상태
```

### PM2 명령어

```bash
pm2 status                  # 프로세스 목록
pm2 logs blog-api           # 실시간 로그
pm2 logs blog-api --lines 50  # 최근 50줄
pm2 restart blog-api        # 재시작
pm2 stop blog-api           # 중지
pm2 delete blog-api         # 삭제
pm2 monit                   # 실시간 모니터링 (CPU/메모리)
```

### 코드 업데이트 배포

```bash
cd /var/www/api
git pull origin main        # 또는 파일 직접 업로드
npm ci
npx prisma generate
npx prisma migrate deploy   # 스키마 변경이 있을 때만
npm run build
pm2 restart blog-api
```

### 헬스체크

```bash
# 서버 내부
curl http://localhost:8000/health

# 외부 (Nginx 경유)
curl http://localhost/health

# HTTPS (SSL 설정 후)
curl https://api.wjdalswo.xyz/health
```

### DB 접속

```bash
sudo -u postgres psql -d blog_prod

# 주요 확인 쿼리
\dt public.*          -- 테이블 목록
\dt auth.*            -- auth 스키마 테이블
SELECT count(*) FROM public.users;
SELECT count(*) FROM public.posts;
```

### 로그 확인

```bash
pm2 logs blog-api --lines 100       # 앱 로그
sudo tail -50 /var/log/nginx/error.log      # Nginx 에러
sudo tail -50 /var/log/nginx/access.log     # Nginx 접근
sudo journalctl -u postgresql --since today  # DB 로그
```

### 리소스 모니터링

```bash
free -h             # 메모리
df -h               # 디스크
htop                # CPU/메모리 실시간 (없으면: sudo apt install htop)
pm2 monit           # Node.js 프로세스 모니터링
```

### 긴급 대응

```bash
# 앱이 죽었을 때
pm2 restart blog-api

# Nginx 에러 시
sudo nginx -t                   # 설정 문법 검사
sudo systemctl restart nginx

# DB 연결 안 될 때
sudo systemctl restart postgresql

# 전체 재시작
pm2 restart blog-api && sudo systemctl restart nginx
```
