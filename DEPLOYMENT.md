# 배포 가이드

이 문서는 InputEnglish 프로젝트의 배포 전략과 방법을 설명합니다.

## 목차

- [배포 플랫폼](#배포-플랫폼)
- [환경 변수 설정](#환경-변수-설정)
- [Vercel 배포](#vercel-배포)
- [Docker 배포](#docker-배포)
- [CI/CD 파이프라인](#cicd-파이프라인)
- [데이터베이스 마이그레이션](#데이터베이스-마이그레이션)
- [모니터링 및 로깅](#모니터링-및-로깅)

---

## 배포 플랫폼

### 권장 플랫폼: Vercel (Production-ready)

**장점:**

- Next.js 최적화 (Edge Functions, ISR, SSR 완벽 지원)
- 자동 스케일링 및 CDN
- Zero-config 배포
- Preview 배포 자동 생성
- 서울 리전(icn1) 지원

**대안:**

- **Docker + AWS ECS/Fargate**: 완전한 제어 필요 시
- **Google Cloud Run**: 컨테이너 기반 서버리스
- **Railway/Render**: 간단한 Docker 배포

---

## 환경 변수 설정

### 필수 환경 변수

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Generative AI
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key

# Application
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
```

### 환경별 설정

- **개발 환경**: `.env.local` (로컬 Supabase 사용)
- **스테이징**: Vercel Preview 환경 변수
- **프로덕션**: Vercel Production 환경 변수

---

## Vercel 배포

### 1. Vercel 프로젝트 생성

```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 연결
vercel link
```

### 2. 환경 변수 설정

Vercel Dashboard → Settings → Environment Variables에서 다음을 추가:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

### 3. 배포

```bash
# Preview 배포
vercel

# Production 배포
vercel --prod
```

### 4. 자동 배포 설정

GitHub 저장소를 Vercel과 연결하면:

- `main` 브랜치 푸시 → Production 배포
- PR 생성 → Preview 배포 자동 생성

---

## Docker 배포

### 로컬 빌드 및 실행

```bash
# 이미지 빌드
docker build -t inputenglish:latest \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
  --build-arg GOOGLE_GENERATIVE_AI_API_KEY=$GOOGLE_GENERATIVE_AI_API_KEY \
  .

# 컨테이너 실행
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
  -e SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
  -e GOOGLE_GENERATIVE_AI_API_KEY=$GOOGLE_GENERATIVE_AI_API_KEY \
  inputenglish:latest
```

### Docker Compose 사용

```bash
# .env 파일 생성
cp .env.example .env
# .env 파일에 실제 값 입력

# 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 서비스 중지
docker-compose down
```

### 프로덕션 배포 (AWS ECS 예시)

```bash
# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com

# 이미지 태그 및 푸시
docker tag inputenglish:latest <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com/inputenglish:latest
docker push <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com/inputenglish:latest

# ECS 서비스 업데이트
aws ecs update-service --cluster my-cluster --service inputenglish --force-new-deployment
```

---

## CI/CD 파이프라인

### GitHub Actions 워크플로우

프로젝트에는 3개의 주요 워크플로우가 설정되어 있습니다:

#### 1. CI (Continuous Integration) - `.github/workflows/ci.yml`

**트리거**: PR 생성/업데이트, main/develop 브랜치 푸시

**작업:**

- ESLint 검사
- TypeScript 타입 체크
- Next.js 빌드
- 보안 스캔 (npm audit, secret 검사)

#### 2. Production 배포 - `.github/workflows/deploy-production.yml`

**트리거**: `main` 브랜치에 푸시

**작업:**

- 테스트 실행
- Vercel Production 배포
- Supabase 마이그레이션 실행
- 배포 URL PR 코멘트

#### 3. Preview 배포 - `.github/workflows/deploy-preview.yml`

**트리거**: PR 생성 (main/develop 대상)

**작업:**

- Vercel Preview 배포
- E2E 테스트 (선택적)
- Preview URL PR 코멘트

#### 4. Lighthouse CI - `.github/workflows/lighthouse-ci.yml`

**트리거**: PR 생성

**작업:**

- 성능 측정 (Lighthouse)
- 리포트 생성 및 업로드

### GitHub Secrets 설정

Repository Settings → Secrets and variables → Actions에서 다음을 추가:

```
# Vercel
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID

# Supabase
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_ID
```

### Vercel Token 생성

1. [Vercel Account Settings](https://vercel.com/account/tokens) 접속
2. "Create Token" 클릭
3. Scope 선택 후 생성
4. GitHub Secrets에 `VERCEL_TOKEN`으로 저장

### Vercel Project ID 확인

```bash
# 프로젝트 루트에서
cat .vercel/project.json
```

또는 Vercel Dashboard → Project Settings에서 확인

---

## 데이터베이스 마이그레이션

### Supabase 마이그레이션 전략

#### 로컬 개발

```bash
# Supabase 로컬 실행
npx supabase start

# 마이그레이션 생성
npx supabase migration new migration_name

# 마이그레이션 적용
npx supabase db push

# 타입 생성
npx supabase gen types typescript --local > src/types/database.types.ts
```

#### Production 배포

```bash
# Supabase 프로젝트 연결
npx supabase link --project-ref your-project-ref

# 마이그레이션 적용
npx supabase db push

# 타입 생성
npx supabase gen types typescript > src/types/database.types.ts
```

### 자동 마이그레이션 (CI/CD)

`deploy-production.yml`에서 자동으로 실행됩니다:

- `main` 브랜치 배포 시 자동으로 마이그레이션 적용

---

## 모니터링 및 로깅

### Vercel Analytics

1. Vercel Dashboard → Analytics 탭
2. 웹 바이탈, 트래픽, 에러율 모니터링

### Supabase Monitoring

1. Supabase Dashboard → Database → Logs
2. API 요청, 쿼리 성능 모니터링

### 추천 도구

- **Sentry**: 에러 트래킹
- **LogRocket**: 세션 리플레이
- **Datadog**: 종합 모니터링
- **Uptime Robot**: 가용성 모니터링

### Health Check

애플리케이션 상태 확인:

```bash
curl https://yourdomain.com/api/health
```

응답:

```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "uptime": 12345.67,
  "environment": "production"
}
```

---

## 배포 체크리스트

### Pre-deployment

- [ ] 모든 환경 변수 설정 완료
- [ ] `.env.example` 파일 업데이트
- [ ] 테스트 통과 확인
- [ ] Supabase 마이그레이션 검증
- [ ] 보안 검사 통과

### Deployment

- [ ] Preview 배포 테스트
- [ ] Production 배포 실행
- [ ] Health check 확인
- [ ] 주요 기능 smoke test
- [ ] 성능 메트릭 확인

### Post-deployment

- [ ] 에러 로그 모니터링
- [ ] 사용자 피드백 수집
- [ ] 성능 메트릭 분석
- [ ] 롤백 계획 준비

---

## 롤백 전략

### Vercel

```bash
# 이전 배포로 롤백
vercel rollback
```

또는 Vercel Dashboard에서 Deployments → 이전 버전 → Promote to Production

### Docker

```bash
# 이전 이미지로 재배포
docker pull <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com/inputenglish:previous-tag
docker tag <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com/inputenglish:previous-tag inputenglish:latest
docker-compose up -d
```

### 데이터베이스

```bash
# 마이그레이션 롤백
npx supabase db reset
```

---

## 문제 해결

### 빌드 실패

1. 로컬에서 `npm run build` 실행
2. TypeScript 에러 확인
3. 환경 변수 누락 확인

### 배포 후 에러

1. Vercel/서버 로그 확인
2. Health check 엔드포인트 테스트
3. 환경 변수 값 재확인
4. Supabase 연결 상태 확인

### 성능 문제

1. Lighthouse CI 리포트 분석
2. Next.js 빌드 분석: `npm run build`
3. 이미지 최적화 확인
4. API 응답 시간 측정

---

## 추가 리소스

- [Next.js 배포 문서](https://nextjs.org/docs/deployment)
- [Vercel 문서](https://vercel.com/docs)
- [Supabase 문서](https://supabase.com/docs)
- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [Docker 문서](https://docs.docker.com/)

---

## 지원

문제가 발생하면 다음을 확인하세요:

1. GitHub Issues
2. Vercel Support
3. Supabase Discord
4. 프로젝트 문서
