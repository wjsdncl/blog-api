# 서버 명령어 모음

> 서버: Oracle Cloud (ubuntu@168.107.6.215)
> 앱 경로: /var/www/api

---

## SSH 접속

```bash
ssh -i "C:\Users\wlke2\.ssh\ssh-key-2026-02-24.key" ubuntu@168.107.6.215
```

---

## PM2 (앱 프로세스 관리)

```bash
pm2 status                     # 프로세스 목록
pm2 logs blog-api              # 실시간 로그
pm2 logs blog-api --lines 50   # 최근 50줄 로그
pm2 restart blog-api           # 재시작
pm2 stop blog-api              # 중지
pm2 delete blog-api            # 삭제
pm2 monit                      # CPU/메모리 실시간 모니터링
pm2 flush                      # 로그 파일 정리
pm2 save                       # 현재 프로세스 목록 저장 (재부팅 대비)
```

---

## Nginx

```bash
sudo nginx -t                        # 설정 문법 검사
sudo systemctl restart nginx         # 재시작
sudo systemctl status nginx          # 상태 확인
sudo systemctl stop nginx            # 중지
sudo systemctl start nginx           # 시작
```

설정 파일 편집:

```bash
sudo nano /etc/nginx/sites-available/blog-api
```

---

## PostgreSQL

```bash
sudo systemctl status postgresql     # 상태 확인
sudo systemctl restart postgresql    # 재시작
sudo -u postgres psql -d blog_prod   # DB 접속
```

DB 접속 후 주요 쿼리:

```sql
\dt public.*                         -- public 테이블 목록
\dt auth.*                           -- auth 테이블 목록
\d 테이블명                           -- 테이블 구조 확인
SELECT count(*) FROM public.users;
SELECT count(*) FROM public.posts;
SELECT count(*) FROM public.comments;
```

---

## 배포 (코드 업데이트)

```bash
cd /var/www/api
git pull origin main
npm ci
npx prisma generate
npx prisma migrate deploy            # 스키마 변경 시에만
npm run build
pm2 restart blog-api
```

---

## Prisma

```bash
cd /var/www/api
npx prisma generate                  # 클라이언트 재생성
npx prisma migrate deploy            # 마이그레이션 적용 (프로덕션)
npx prisma migrate dev --name 설명   # 마이그레이션 생성 (개발)
npx prisma db seed                   # 시드 데이터 삽입
npx prisma studio                    # DB GUI (로컬 개발용)
npx prisma format                    # 스키마 파일 포맷팅
```

---

## SSL 인증서

```bash
sudo certbot certificates            # 인증서 목록 및 만료일 확인
sudo certbot renew --dry-run         # 자동 갱신 테스트
sudo certbot renew                   # 수동 갱신
sudo systemctl status certbot.timer  # 자동 갱신 타이머 상태
```

---

## 헬스체크

```bash
curl http://localhost:8000/health    # 앱 직접
curl http://localhost/health         # Nginx 경유
curl https://api.wjdalswo.xyz/health # 외부 HTTPS
```

---

## 로그 확인

```bash
pm2 logs blog-api --lines 100                   # 앱 로그
sudo tail -50 /var/log/nginx/error.log           # Nginx 에러
sudo tail -50 /var/log/nginx/access.log          # Nginx 접근
sudo journalctl -u postgresql --since today      # DB 로그
```

---

## 리소스 모니터링

```bash
free -h                              # 메모리 (RAM + Swap)
df -h                                # 디스크 사용량
htop                                 # CPU/메모리 실시간
pm2 monit                            # Node.js 프로세스 모니터링
```

---

## 긴급 대응

```bash
# 앱이 죽었을 때
pm2 restart blog-api

# Nginx 에러
sudo nginx -t && sudo systemctl restart nginx

# DB 연결 안 될 때
sudo systemctl restart postgresql

# 전체 재시작
pm2 restart blog-api && sudo systemctl restart nginx

# 서버 재부팅
sudo reboot
```

---

## 환경변수 편집

```bash
sudo nano /var/www/api/.env
pm2 restart blog-api                 # .env 변경 후 반드시 재시작
```

---

## 디스크/로그 정리

```bash
pm2 flush                                       # PM2 로그 전체 삭제
sudo journalctl --vacuum-time=7d                 # 시스템 로그 7일만 유지
sudo apt-get autoremove -y                       # 불필요 패키지 제거
```
