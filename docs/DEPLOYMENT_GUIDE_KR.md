# 배포 가이드 - 비개발자도 이해하는 버전

## 📖 목차

1. [배포 전략 쉽게 이해하기](#배포-전략-쉽게-이해하기)
2. [CI/CD 파이프라인이란?](#cicd-파이프라인이란)
3. [안전한 배포 프로세스](#안전한-배포-프로세스)
4. [변경사항 반영 방법](#변경사항-반영-방법)
5. [잠재적 위험과 해결책](#잠재적-위험과-해결책)

---

## 🎯 배포 전략 쉽게 이해하기

### Vercel = 우리 웹사이트를 전세계에 공개하는 서비스

**현실 세계 비유: 음식 배달 플랫폼**

| 배달 서비스 | 우리 프로젝트   |
| ----------- | --------------- |
| 요리 (음식) | 코드 (프로그램) |
| 배달원      | Vercel 서버     |
| 고객        | 사용자          |
| 주문        | HTTP 요청       |

### 왜 Vercel을 선택했나?

#### 1. Next.js 최적화 ⚡

- **비유**: 현대차를 현대 정비소에서 관리
- **설명**: Vercel이 Next.js를 만든 회사라서 100% 호환
- **장점**:
  - 자동으로 최고 성능으로 설정
  - 문제 발생 시 빠른 해결
  - 최신 기능 즉시 사용 가능

#### 2. 서울 리전 지원 🇰🇷

- **비유**: 강남 음식점 → 강남 배달 vs 부산 → 강남 배달
- **설명**: 서버가 서울에 있어서 한국 사용자에게 빠름
- **수치**:
  - 서울 서버: 10-50ms 응답 시간
  - 미국 서버: 200-500ms 응답 시간

#### 3. 자동 스케일링 📈

- **비유**: 손님 많으면 자동으로 홀 확장하는 식당
- **설명**:
  - 사용자 10명일 때: 작은 서버
  - 사용자 10,000명일 때: 자동으로 큰 서버
- **비용**: 사용한 만큼만 과금 (효율적)

#### 4. 글로벌 CDN 🌍

- **비유**: 프랜차이즈 - 여러 지역에 매장
- **설명**:
  - 이미지, CSS 파일을 전세계 서버에 복사
  - 사용자와 가장 가까운 서버에서 전송
- **장점**: 어디서든 빠른 속도

---

## 🔄 CI/CD 파이프라인이란?

### 자동 품질 관리 시스템

**비유: 자동차 공장의 생산 라인**

```
재료 투입 → 조립 → 품질 검사 → 테스트 주행 → 출고 → 전시장 배치
   ↓          ↓        ↓           ↓         ↓         ↓
 코드 작성 → 빌드 →  검사   →    테스트   → 배포  → 실제 서비스
```

### 워크플로우 1: PR 생성 시 (테스트 단계)

**언제**: 개발자가 "이 기능 추가했어요, 확인해주세요" 할 때

**무슨 일이 일어나나?**

#### 1단계: Lint & Type Check ✍️

```
목적: 코드 품질 검사
비유: 맞춤법 검사기
시간: 30초~1분
```

**검사 내용**:

- 변수 이름이 규칙에 맞는가?
- 오타가 없는가?
- 타입 에러가 없는가?

**통과 기준**: 모든 규칙 준수

**실패 예시**:

```typescript
// ❌ 실패 - 사용하지 않는 변수
const unusedVariable = 10;

// ✅ 통과
const userId = getUserId();
console.log(userId);
```

#### 2단계: Build Test 🏗️

```
목적: 실제 웹사이트로 만들어지는지 확인
비유: 레고 조립 - 모든 부품이 맞는지
시간: 2~5분
```

**검사 내용**:

- 모든 파일이 제대로 연결되는가?
- 라이브러리가 올바르게 설치되었나?
- 빌드 과정에서 에러가 없나?

**통과 기준**: 에러 0개

**실패 예시**:

```typescript
// ❌ 실패 - 존재하지 않는 파일 import
import { User } from "./non-existent-file";

// ✅ 통과
import { User } from "./types/user";
```

#### 3단계: Security Scan 🔒

```
목적: 보안 위협 탐지
비유: 공항 보안 검색대
시간: 1~2분
```

**검사 내용**:

- 비밀번호나 API 키가 코드에 노출되었나?
- 위험한 라이브러리를 사용하는가?
- 알려진 보안 취약점이 있나?

**통과 기준**: 심각한 위협 0개

**실패 예시**:

```typescript
// ❌ 실패 - API 키 노출
const apiKey = "AIzaSyXXXXXXXXXXXX";

// ✅ 통과 - 환경 변수 사용
const apiKey = process.env.GOOGLE_AI_API_KEY;
```

#### 4단계: Lighthouse Performance 📊

```
목적: 성능 측정
비유: 자동차 연비/속도 테스트
시간: 3~5분
```

**측정 항목**:

- **Performance**: 로딩 속도 (목표: 90점 이상)
- **Accessibility**: 장애인 접근성 (목표: 90점 이상)
- **Best Practices**: 모범 사례 준수 (목표: 95점 이상)
- **SEO**: 검색 엔진 최적화 (목표: 90점 이상)

**결과 예시**:

```
Performance: 95/100 ✅
Accessibility: 88/100 ⚠️ (경고)
Best Practices: 100/100 ✅
SEO: 92/100 ✅
```

#### 5단계: Preview 배포 🌐

```
목적: 실제 작동하는 테스트 사이트 생성
비유: 시제품 전시
시간: 2~3분
```

**생성되는 것**:

- 고유한 URL: `https://inputenglish-pr-123.vercel.app`
- 실제로 사용 가능한 웹사이트
- 실제 서비스와 분리된 테스트 환경

**활용 방법**:

```
1. PR 페이지에서 Preview URL 클릭
2. 실제로 기능 테스트
3. 문제 발견 시 코드 수정 → 자동으로 재배포
4. 확인 완료 → PR 승인
```

---

### 워크플로우 2: main 푸시 시 (실제 배포)

**언제**: PR이 승인되어 main 브랜치에 합쳐질 때

**무슨 일이 일어나나?**

```
[자동 실행]
  ↓
모든 검사 재실행 (1~5단계)
  ↓
실제 서비스 배포 (production)
  ↓
데이터베이스 마이그레이션
  ↓
팀에게 알림 발송
```

#### 차이점: Preview vs Production

| 항목         | Preview           | Production       |
| ------------ | ----------------- | ---------------- |
| URL          | pr-123.vercel.app | yourdomain.com   |
| 데이터베이스 | 테스트 DB         | 실제 DB          |
| 사용자       | 팀 내부           | 실제 사용자      |
| 에러 영향    | 팀만 봄           | 모든 사용자가 봄 |

---

## 🛡️ 안전한 배포 프로세스

### 3단계 안전장치

#### 1단계: 개발자 로컬 테스트

```
개발자 PC → 코드 작성 → 로컬 테스트
```

**수동 검사**:

- `npm run dev` - 로컬 실행
- `npm run build` - 빌드 테스트
- `npm run type-check` - 타입 검사

#### 2단계: PR Preview 자동 테스트

```
GitHub PR → 자동 검사 → Preview 배포 → 팀 검토
```

**자동 검사** (위의 1~5단계)

**팀 검토**:

- 코드 리뷰
- 실제 Preview 사이트 테스트
- 승인/반려 결정

#### 3단계: Production 배포

```
PR 승인 → main 합침 → 자동 검사 → 배포 → 모니터링
```

**추가 안전장치**:

- Rollback 기능: 문제 발생 시 이전 버전으로 즉시 복구
- Health Check: 배포 후 자동으로 서비스 정상 작동 확인
- 점진적 배포: 일부 사용자에게만 먼저 적용 가능

---

## 🔄 변경사항 반영 방법

### 시나리오: 버그 수정 후 배포

**전체 흐름**:

```
1. 로컬에서 버그 수정
   ↓
2. Git에 커밋
   ↓
3. GitHub에 푸시
   ↓
4. PR 생성
   ↓
5. 자동 테스트 (5~10분)
   ↓
6. Preview 사이트 확인
   ↓
7. 팀 검토 및 승인
   ↓
8. main 브랜치에 합침
   ↓
9. 자동 배포 (3~5분)
   ↓
10. 실제 서비스 반영 완료!
```

### 상세 단계별 설명

#### 단계 1-3: 코드 작성 및 업로드

```bash
# 1. 버그 수정 후 저장
# 2. Git 커밋
git add .
git commit -m "fix: 로그인 버튼 클릭 안되는 문제 수정"

# 3. GitHub에 업로드
git push origin feature/fix-login-button
```

**소요 시간**: 1분

#### 단계 4-6: 자동 테스트 및 Preview

```
GitHub에서 자동 실행:
- Lint Check ✅ (30초)
- Build Test ✅ (2분)
- Security Scan ✅ (1분)
- Performance Test ✅ (3분)
- Preview 배포 ✅ (2분)

총 소요 시간: 약 8분
```

**Preview URL 생성**:

```
https://inputenglish-git-fix-login-button.vercel.app
```

#### 단계 7: 팀 검토

```
1. PR 페이지에서 코드 리뷰
2. Preview URL에서 실제 테스트
3. "Approve" 또는 "Request Changes"
```

**소요 시간**: 팀 검토 시간에 따라 다름 (수분~수시간)

#### 단계 8-10: 자동 배포

```
PR 승인 → Merge 버튼 클릭
  ↓
자동으로:
1. 모든 테스트 재실행 ✅
2. Production 빌드 ✅
3. Vercel에 배포 ✅
4. 데이터베이스 마이그레이션 ✅
5. Health Check ✅
6. 팀에게 알림 발송 ✅

총 소요 시간: 약 5분
```

### 긴급 버그 수정 (Hotfix)

**빠른 배포 프로세스**:

```bash
# 1. hotfix 브랜치 생성
git checkout -b hotfix/critical-bug

# 2. 수정 후 즉시 커밋
git add .
git commit -m "hotfix: 결제 오류 긴급 수정"

# 3. main에 직접 푸시 (긴급한 경우)
git checkout main
git merge hotfix/critical-bug
git push origin main

# 자동 배포 시작 (3~5분 후 반영)
```

**주의**: 긴급 상황에만 사용!

---

## ⚠️ 잠재적 위험과 해결책

### 위험 1: 배포 중 에러 발생

**시나리오**: 배포 중 빌드 실패

```
Deployment Failed ❌
Error: Module not found: './components/NewFeature'
```

**원인**:

- 파일명 오타
- import 경로 오류
- 의존성 누락

**해결책**:

```
1. GitHub Actions 로그 확인
2. 로컬에서 npm run build 실행
3. 에러 수정
4. 다시 푸시
→ 자동으로 재배포 시도
```

**영향**: 실제 서비스는 이전 버전 그대로 유지 (안전)

---

### 위험 2: 배포는 성공했지만 버그 발생

**시나리오**: 배포 후 사용자가 오류 보고

```
사용자: "로그인이 안돼요!"
```

**즉시 대응 방법**:

#### Option 1: Rollback (추천)

```bash
# Vercel Dashboard에서 클릭 한 번으로 이전 버전 복구
Deployments → 이전 버전 → "Promote to Production"

소요 시간: 1분
```

#### Option 2: 긴급 수정 배포

```bash
# 버그 수정 후 즉시 배포
git checkout main
# 수정...
git commit -m "hotfix: 로그인 오류 수정"
git push origin main

소요 시간: 5~10분
```

**모니터링**:

```
배포 후 확인 사항:
✅ Health Check 통과 여부
✅ Vercel 대시보드 에러 로그
✅ Supabase 데이터베이스 상태
✅ 사용자 피드백
```

---

### 위험 3: 데이터베이스 마이그레이션 실패

**시나리오**: DB 스키마 변경 중 에러

```
Migration Failed ❌
Error: Column 'user_email' already exists
```

**원인**:

- 마이그레이션 파일 중복
- DB 스키마 충돌
- 잘못된 SQL 문법

**해결책**:

#### 1. 즉시 조치

```bash
# 로컬에서 마이그레이션 테스트
npm run supabase:start
npm run supabase:push

# 에러 확인 후 수정
```

#### 2. 안전한 재배포

```bash
# 수정된 마이그레이션 다시 푸시
git add supabase/migrations/
git commit -m "fix: 마이그레이션 오류 수정"
git push origin main
```

**예방책**:

```
배포 전 체크리스트:
☑ 로컬 Supabase에서 마이그레이션 테스트
☑ 백업 확인
☑ 롤백 계획 준비
```

---

### 위험 4: 환경 변수 누락

**시나리오**: 새 환경 변수 추가했는데 배포 환경에 설정 안 함

```
Runtime Error ❌
Error: GOOGLE_AI_API_KEY is not defined
```

**해결책**:

```
1. Vercel Dashboard 접속
2. Settings → Environment Variables
3. 누락된 변수 추가:
   - GOOGLE_AI_API_KEY = AIzaSy...
4. Redeploy (재배포)

소요 시간: 2~3분
```

**예방책**:

```
.env.example 파일에 항상 새 변수 추가
→ 팀원들이 바로 확인 가능
```

---

### 위험 5: 동시 배포 충돌

**시나리오**: 여러 개발자가 동시에 배포

```
개발자 A: 기능 X 배포 중...
개발자 B: 기능 Y 배포 시작
→ 충돌 발생?
```

**실제 동작**:

```
✅ Vercel이 자동으로 순서 처리
1. A의 배포 완료 대기
2. B의 배포 순차 실행

충돌 없음!
```

**주의사항**:

```
동일 파일 수정 시:
→ Git에서 merge conflict 발생 가능
→ 수동으로 충돌 해결 필요
```

---

## 📊 배포 모니터링 및 알림

### 자동 알림 설정

**GitHub PR 코멘트**:

```
🚀 Preview deployment ready!
📍 Preview URL: https://inputenglish-pr-42.vercel.app
✅ Build completed successfully.
```

**Production 배포 알림**:

```
✅ Deployed to production: https://yourdomain.com
🕐 Build time: 3m 24s
📊 Lighthouse Score: 95/100
```

### 실시간 모니터링

**Vercel Analytics**:

```
실시간 확인 가능:
- 방문자 수
- 에러율
- 페이지 로딩 속도
- 지역별 접속 현황
```

**Supabase Dashboard**:

```
실시간 확인 가능:
- DB 쿼리 성능
- API 요청 수
- 에러 로그
- DB 용량
```

---

## 🎯 배포 Best Practices

### 배포 전 체크리스트

```
□ 로컬에서 npm run build 성공
□ 로컬에서 npm run type-check 통과
□ .env.example 업데이트 완료
□ Supabase 마이그레이션 테스트 완료
□ Preview 배포에서 테스트 완료
□ 팀 리뷰 승인 완료
□ 배포 시간대 확인 (사용자 적은 시간대 권장)
```

### 배포 후 체크리스트

```
□ Health Check API 확인: /api/health
□ 주요 기능 Smoke Test
  - 로그인/로그아웃
  - 영상 재생
  - 데이터 저장
□ Vercel Dashboard 에러 로그 확인
□ Lighthouse 성능 점수 확인
□ 사용자 피드백 모니터링 (첫 1시간)
```

---

## 🚨 롤백 가이드

### Vercel에서 롤백 (가장 빠름)

**방법 1: 대시보드 사용**

```
1. Vercel Dashboard → Deployments
2. 정상 작동하던 이전 버전 선택
3. "Promote to Production" 클릭
4. 완료! (1분 소요)
```

**방법 2: CLI 사용**

```bash
vercel rollback
# 바로 이전 버전으로 복구
```

### Git에서 롤백

**방법**:

```bash
# 1. 문제 있는 커밋 찾기
git log --oneline

# 2. 해당 커밋 되돌리기
git revert abc1234

# 3. 푸시하여 재배포
git push origin main
```

---

## 💡 요약: 질문 답변

### Q1: "재배포만 하면 되는거야?"

**A: 네, 하지만 자동화되어 있습니다!**

```
코드 수정 → Git 푸시 → 자동 테스트 → 자동 배포 → 완료!
```

**수동 작업**: Git 푸시만
**자동 작업**: 테스트, 빌드, 배포, DB 마이그레이션, 알림

---

### Q2: "불안정한 부분은 없어?"

**A: 여러 안전장치가 있습니다!**

**안전장치 5가지**:

1. **Preview 배포**: 실제 배포 전 테스트
2. **자동 테스트**: 에러 사전 차단
3. **Health Check**: 배포 후 자동 점검
4. **Rollback**: 1분 안에 이전 버전 복구
5. **분리된 환경**: 테스트가 실제 서비스에 영향 없음

**잠재적 위험**:

| 위험                 | 확률 | 대응 시간             |
| -------------------- | ---- | --------------------- |
| 빌드 실패            | 낮음 | 즉시 감지 (배포 안됨) |
| 런타임 에러          | 중간 | 1분 (Rollback)        |
| DB 마이그레이션 실패 | 낮음 | 5분 (수정 후 재배포)  |
| 환경 변수 누락       | 낮음 | 3분 (설정 후 재배포)  |

**결론**:

- 대부분 자동으로 방지
- 문제 발생 시 빠른 복구 가능
- 실제 서비스 중단 위험 매우 낮음

---

## 📚 추가 학습 자료

### 초보자용

- [Vercel 배포 기초](https://vercel.com/docs)
- [Git 기초](https://guides.github.com/introduction/git-handbook/)

### 중급자용

- [CI/CD 개념](https://www.redhat.com/ko/topics/devops/what-is-ci-cd)
- [Next.js 배포 최적화](https://nextjs.org/docs/deployment)

### 고급자용

- [GitHub Actions 워크플로우](https://docs.github.com/en/actions)
- [Supabase 마이그레이션](https://supabase.com/docs/guides/cli/local-development)

---

## 🆘 문제 발생 시 연락처

1. **GitHub Issues**: 프로젝트 저장소의 Issues 탭
2. **Vercel Support**: support@vercel.com
3. **Supabase Discord**: https://discord.supabase.com
4. **팀 Slack**: #deployment 채널
