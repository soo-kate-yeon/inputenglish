---
id: SPEC-WEB-001
version: 0.1.0
status: Planned
created: 2026-06-30
updated: 2026-06-30
author: soo-kate-yeon
priority: High
platform: web-primary
depends_on: SPEC-INPUT-001, SPEC-INPUT-002
---

# SPEC-WEB-001: 유료 웹 출시 (토스페이먼츠 월 구독 + 웹 인증 + 데일리 학습 웹 포팅)

> 본 SPEC은 "인풋영어를 **웹 단독 유료 제품(월 ₩4,900)**으로 출시"하기 위한 최소 경로를 정의한다. 앱스토어 30% 수수료를 회피하기 위해 결제는 **토스페이먼츠(빌링키 정기결제)**로 웹에서 직접 받으며, 모바일(RevenueCat/앱스토어 인앱결제) 경로와 독립적으로 동작한다.
> 근거: 코드베이스 현황 분석(launch-readiness assessment, 2026-06-30) — 백엔드 세션 조립 API·entitlement·Supabase 인프라는 이미 존재하나, ① 웹 사용자 인증 ② 토스 결제 ③ 유저용 학습 화면이 미구현. PWA는 본 SPEC 범위 밖(Phase 2).
> Reference 인용은 `Reference: {file_path}:{line_range}` 형식을 사용한다.

---

## HISTORY

- **v0.1.0 — 2026-06-30** — 초안. 웹 유료 출시 수직 슬라이스 5개 모듈 정의(웹 인증 · 토스 빌링키 정기결제 · 구독 라이프사이클/웹훅/dunning · 데일리 학습 웹 포팅 · 리마인드+Render 운영). 결제수단=토스페이먼츠 빌링키, 가격=₩4,900/월, 무료체험=기존 7일 트라이얼 계승, 배포=Render로 확정. author: soo-kate-yeon.

---

## 결정된 기본값 (Resolved Decisions)

| # | 결정 항목 | 확정값 | 관련 REQ |
|---|-----------|--------|---------|
| D1 | 결제수단 | 토스페이먼츠 **빌링키 정기결제**(카드 자동결제). 단건결제 아님. 매월 서버가 billingKey로 승인 API 호출. | REQ-WEB-002, REQ-WEB-003 |
| D2 | 가격/플랜 | 단일 플랜 **월 ₩4,900**. 연간 결제·할인·친구코드는 본 슬라이스 Out(Phase 2). | REQ-WEB-002 |
| D3 | 무료체험 | 기존 7일 트라이얼 로직 계승(`entitlement.ts` `TRIAL_DAYS=7`). 체험 종료 시 결제 유도, 미결제 시 콘텐츠 차단. | REQ-WEB-002, REQ-WEB-004 |
| D4 | 인증 | Supabase Auth(웹). Google·Apple·이메일 OTP. 모바일 `AuthContext` 패턴을 SSR(`@supabase/ssr`)로 웹 이식. | REQ-WEB-001 |
| D5 | 리마인드 채널 | **카카오 알림톡(정보성 템플릿) = primary**, 실패 시 **이메일 폴백**. 학습 리마인드·결제실패 안내 모두 정보성으로 설계. | REQ-WEB-005 |
| D6 | 배포 | **Render**(Web Service + Cron Job). 기존 `vercel.json` cron은 Render Cron으로 이전. 리전은 가용 시 한국 인접(Singapore) 선택. | §5 |
| D7 | 학습 UI 범위(MVP) | "오늘 세션" 단일 플로우만 포팅: 리딩 1편 + 리스닝 세그먼트 N + 하이라이트 질문. 아카이브·프로필·상세 통계는 Out(후속). | REQ-WEB-004 |

### 미결 결정 (Open Decisions — run phase 전 확정 필요)

| # | 항목 | 후보 | 영향 |
|---|------|------|------|
| O-1 | 알림톡 발송 벤더 | 솔라피(Solapi) / NHN Cloud / 카카오 비즈메시지 직접 | REQ-WEB-005 구현·템플릿 사전심사 |
| O-2 | 이메일 발송 벤더 | Resend / AWS SES / Postmark | REQ-WEB-005 폴백 구현 |
| O-3 | 빌링키 저장 위치 | Supabase 신규 `subscriptions` 테이블(암호화 컬럼) vs 토스 보관·로컬은 customerKey만 | REQ-WEB-002-U2 보안 모델 |
| O-4 | 해지 정책 | 즉시 해지(잔여기간 유지) vs 기간말 해지 | REQ-WEB-003-E3 |
| O-5 | 결제 실패 재시도 정책 | N회(예: 3일 간격 3회) 후 강등 | REQ-WEB-003-W1 |

---

## 1. 배경 (Background)

### 1.1 왜 웹 유료 출시인가

앱스토어/플레이스토어 인앱결제는 디지털 구독 매출의 약 30%를 수수료로 가져간다. 월 ₩4,900 가격대에서 30% 손실은 치명적이다. 반면 **토스페이먼츠 웹 결제 수수료는 한 자릿수(%)** 수준이며, 제품 자체가 이미 Next.js 웹앱이므로 네이티브 앱 없이도 출시 가능하다. 리텐션 수단(홈화면 정착·푸시)은 PWA + 카카오 알림톡 + 이메일로 대체한다(PWA는 Phase 2).

### 1.2 현황: 무엇이 되어 있고 무엇이 비는가

코드베이스 분석(2026-06-30) 결과:

**이미 존재(재사용·INVIOLABLE KEEP):**
- 유저용 세션 조립 API — `/api/premium/today`, `/api/premium/sessions`, `/api/premium/reading`, `/api/premium/question`, `/api/premium/vocab-*`. 모바일용으로 구축됐으나 인증·entitlement 게이트가 이미 서버사이드로 동작.
  - Reference: `apps/web/src/app/api/premium/today/route.ts:1-40` (`requireApiUser` + `resolvePremiumEntitlement` 게이트, 402 응답)
- 구독 상태 모델 — `users.plan`(FREE/PREMIUM) + 7일 트라이얼 판별.
  - Reference: `apps/web/src/lib/premium/entitlement.ts:20-58` (`resolvePremiumEntitlement`)
  - Reference: `supabase/migrations/20260405100000_add_plan_column_to_users.sql` (plan 컬럼 CHECK)
- Supabase 인증 인프라(웹) — SSR 클라이언트·미들웨어 존재.
  - Reference: `apps/web/src/utils/supabase/{server.ts,client.ts,middleware.ts,api-auth.ts}`
- 콘텐츠 파이프라인(어드민) — 유튜브 자막 인제스트·리딩 풀 생성 cron 등 완비.

**비어 있음(본 SPEC이 채움):**
- 웹 사용자 로그인/회원가입 — 로그인 페이지는 **버튼만 있는 껍데기**(onClick 없음).
  - Reference: `apps/web/src/app/login/page.tsx:32-58` (핸들러 없는 3개 CTA 버튼)
- 토스페이먼츠 연동 — SDK·결제창·승인 API·웹훅·빌링키 전부 **0건**(코드베이스 toss 참조 없음).
- 유저용 데일리 학습 화면(웹) — 루트가 `/admin`으로 리다이렉트. 유저 학습 surface 없음.
- 구독 라이프사이클(갱신·해지·결제실패 dunning), Render 배포 구성.

### 1.3 핵심 비대칭: "만드는 게 아니라 잇는다"

세션 조립·콘텐츠·entitlement·인증 인프라가 이미 서버에 있으므로, 본 슬라이스의 대부분은 **신규 구축이 아니라 연결**이다. 신규 구축이 필요한 단 하나의 큰 덩어리는 **토스페이먼츠 정기결제(빌링키)**이며, 나머지(웹 인증·학습 UI)는 기존 API/모바일 화면을 웹으로 잇는 작업이다.

---

## 2. 목표 / 비목표 (Goals / Non-Goals)

### 2.1 Goals (수직 슬라이스 = 가입→결제→학습 일주)

| # | 목표 |
|---|------|
| G1 | 웹 사용자 인증: Google·Apple·이메일로 실제 가입/로그인 가능(SSR 세션) |
| G2 | 토스페이먼츠 빌링키 정기결제: 카드 등록 → billingKey 발급 → 월 ₩4,900 자동결제 → `users.plan=PREMIUM` 반영 |
| G3 | 구독 라이프사이클: 갱신 자동결제 cron + 해지 + 결제실패 dunning(알림톡/이메일) + 토스 웹훅 수신 |
| G4 | 데일리 학습 웹 화면: 기존 `/api/premium/today`를 소비하는 유저용 "오늘 세션" 플로우(리딩+세그먼트+하이라이트 질문), 서버 entitlement 게이트 |
| G5 | 리마인드 + 운영: 카카오 알림톡(정보성)+이메일 리마인드, Render 배포(Web Service+Cron) |

### 2.2 Non-Goals (명시적 제외 — 후속/Phase 2)

- **PWA**(manifest·설치 유도·오프라인 캐싱) — Phase 2.
- **연간 결제·할인·친구코드·가격 실험** — 본 슬라이스는 단일 월 ₩4,900만.
- **아카이브·프로필·학습 통계·설정 화면 웹 포팅** — MVP는 "오늘 세션" 1플로우만(D7).
- **모바일(RevenueCat) 경로 변경** — 모바일은 현행 유지, 웹 결제와 독립.
- **간편결제 외 결제수단**(가상계좌·휴대폰·해외카드) — 카드 빌링키만.
- **세금계산서·현금영수증 자동발행, 환불 자동화 UI** — 운영 수동 처리로 시작.
- **다국가/다통화** — KRW 단일.

---

## 3. EARS 요구사항

> EARS 5종: Ubiquitous(항상), Event-driven(WHEN), State-driven(WHILE), Optional(WHERE), Unwanted(IF/THEN ... shall not). 기술 식별자는 영어로 유지한다.

### REQ-WEB-001 — 웹 사용자 인증 / 계정

목적: 유저가 웹에서 실제로 가입·로그인하고 SSR 세션을 유지한다. 모바일 `AuthContext` 패턴을 `@supabase/ssr` 기반 웹으로 이식한다.
관련: 기존 Supabase SSR 유틸 재사용. 신규는 로그인 핸들러·OAuth 콜백 라우트·세션 미들웨어 게이팅.

- **U1 (Ubiquitous):** 시스템은 항상 인증된 사용자에 대해 SSR 요청·API 요청 양쪽에서 동일한 Supabase 세션(쿠키 기반)을 유효하게 유지해야 한다.
  - Reference: `apps/web/src/utils/supabase/middleware.ts`, `apps/web/src/utils/supabase/api-auth.ts` (`requireApiUser`)
- **E1 (Event-driven, WHEN):** WHEN 사용자가 로그인 페이지에서 Google·Apple·이메일 OTP 중 하나를 선택하면, THEN 시스템은 해당 인증 플로우(OAuth PKCE 또는 이메일 매직링크/OTP)를 개시해야 한다.
  - Reference: `apps/web/src/app/login/page.tsx:32-58` (핸들러 부착 대상) · `apps/mobile/src/contexts/AuthContext.tsx` (provider 목록·PKCE 패턴 이식 근거)
- **E2 (Event-driven, WHEN):** WHEN OAuth/매직링크 콜백이 도착하면, THEN 시스템은 세션을 수립하고 `users` 레코드(없으면 생성, `plan=FREE`, `created_at`=now)를 보장한 뒤 학습 홈으로 리다이렉트해야 한다.
  - Reference: `supabase/migrations/20260405100000_add_plan_column_to_users.sql` (FREE 기본값)
- **W1 (State-driven, WHILE):** WHILE 사용자가 비로그인 상태인 동안, THEN 시스템은 학습·결제·계정 보호 경로 접근을 로그인 페이지로 유도해야 한다(콘텐츠 미노출).
- **U2 (Unwanted, IF/THEN):** IF 세션이 만료·무효라면, THEN 시스템은 보호된 API에 대해 콘텐츠 대신 401을 반환해야 하며 클라이언트는 재로그인을 유도해야 한다.

### REQ-WEB-002 — 토스페이먼츠 빌링키 정기결제 (구독 시작)

목적: 무료체험 종료/구독 의향 사용자가 카드를 등록하면 billingKey를 발급받고 첫 결제를 승인하여 `plan=PREMIUM`으로 전환한다.
관련: 신규 `subscriptions` 테이블(O-3), 토스 SDK(`@tosspayments/tosspayments-sdk`) + 서버 승인 API. **모든 금액 판정·plan 갱신은 서버에서만** 수행(클라이언트 신뢰 금지).

- **U1 (Ubiquitous):** 시스템은 항상 구독 가격을 단일 플랜 **월 ₩4,900(KRW)**으로 취급하고, 결제 금액·통화·주문정보를 서버에서 확정해야 한다(클라이언트 전달 금액을 신뢰하지 않음).
- **E1 (Event-driven, WHEN):** WHEN 사용자가 카드 등록(빌링 인증)을 완료하면, THEN 시스템은 토스 `authKey`를 서버에서 billingKey 발급 API로 교환하고, 사용자별 `customerKey`와 함께 안전하게 저장해야 한다.
  - Reference: 신규 `apps/web/src/app/api/billing/issue/route.ts`(생성 예정) · 토스페이먼츠 빌링 발급 `POST /v1/billing/authorizations/issue`
- **E2 (Event-driven, WHEN):** WHEN billingKey 발급이 성공하면, THEN 시스템은 즉시 첫 회차 자동결제를 승인하고, 승인 성공 시에만 `users.plan=PREMIUM`과 `subscriptions`(상태·다음결제일·금액) 레코드를 갱신해야 한다.
- **U2 (Ubiquitous):** 시스템은 항상 billingKey 등 결제 민감정보를 클라이언트로 반환하지 않으며, 서버 비공개 환경변수의 시크릿 키로만 토스 API를 호출해야 한다(RLS: `subscriptions`는 본인 SELECT, 서버 전용 WRITE).
- **W1 (State-driven, WHILE):** WHILE 사용자가 7일 무료체험 기간 내인 동안, THEN 시스템은 결제 없이 콘텐츠 접근을 허용하되 체험 잔여일과 결제 전환 CTA를 표시해야 한다.
  - Reference: `apps/web/src/lib/premium/entitlement.ts:20-58` (trial 판별 — 변경 없이 계승)
- **U3 (Unwanted, IF/THEN):** IF 첫 회차 자동결제 승인이 실패하면, THEN 시스템은 `plan`을 PREMIUM으로 올리지 않아야 하며 사용자에게 카드 변경/재시도를 안내해야 한다.
- **U4 (Unwanted, IF/THEN):** IF 동일 결제건(주문/멱등키)이 중복 요청되면, THEN 시스템은 중복 승인·중복 과금을 발생시키지 않아야 한다(멱등 처리).

### REQ-WEB-003 — 구독 라이프사이클: 갱신 · 해지 · 결제실패 dunning · 웹훅

목적: 정기결제의 월 갱신, 사용자 해지, 결제 실패 시 재시도/안내, 토스 웹훅 동기화로 `plan`을 신뢰 가능한 단일 진실로 유지한다.
관련: Render Cron(월 갱신 배치), 신규 `/api/billing/webhook`, dunning 발송(REQ-WEB-005 연계).

- **E1 (Event-driven, WHEN):** WHEN 구독의 다음 결제일이 도래하면, THEN 시스템은 저장된 billingKey로 월 ₩4,900 자동결제를 승인하고, 성공 시 다음 결제일을 +1개월로 갱신해야 한다.
  - Reference: 신규 Render Cron Job(일 1회) → `subscriptions.next_billing_at <= today` 대상 결제
- **E2 (Event-driven, WHEN):** WHEN 토스 결제 상태 변경 웹훅(승인/취소/실패)이 수신되면, THEN 시스템은 서명/출처를 검증한 뒤 `subscriptions`와 `users.plan`을 웹훅 사실에 맞춰 동기화해야 한다.
  - Reference: 신규 `apps/web/src/app/api/billing/webhook/route.ts`
- **E3 (Event-driven, WHEN):** WHEN 사용자가 구독 해지를 요청하면, THEN 시스템은 자동결제 갱신을 중단하고 해지 정책(O-4: 기간말까지 접근 유지 등)에 따라 만료 시점을 설정해야 한다.
- **W1 (State-driven, WHILE):** WHILE 월 자동결제가 실패 상태인 동안, THEN 시스템은 dunning 일정(O-5: 예: 3일 간격 최대 3회)에 따라 재시도하고 매 실패마다 카드 변경 안내를 발송해야 한다(REQ-WEB-005).
- **W2 (State-driven, WHILE):** WHILE 결제가 최종 실패(재시도 소진) 또는 해지 만료 상태인 동안, THEN 시스템은 `users.plan=FREE`로 강등하고 유료 콘텐츠 접근을 차단해야 한다.
- **U1 (Unwanted, IF/THEN):** IF 웹훅 서명 검증에 실패하거나 출처가 신뢰되지 않는다면, THEN 시스템은 해당 요청으로 어떤 결제/plan 상태도 변경하지 않아야 한다.

### REQ-WEB-004 — 유저용 데일리 학습 화면 (웹 포팅)

목적: 로그인+entitlement를 통과한 유저가 웹에서 "오늘 세션"(리딩 1편 + 리스닝 세그먼트 N + 하이라이트 질문)을 학습한다. 기존 API를 소비하는 클라이언트 화면을 신규 구축한다.
관련: 기존 `/api/premium/*` 소비. 모바일 화면(`PremiumSessionScreen` 등)의 UX를 웹으로 이식하되 v1.3 제외 surface(롤플레잉·표현카드·6스텝)는 도입하지 않는다.

- **U1 (Ubiquitous):** 시스템은 항상 학습 콘텐츠 접근 전에 서버사이드 entitlement를 확인하고, 접근 권한이 없으면 콘텐츠 대신 결제/체험 안내를 반환해야 한다.
  - Reference: `apps/web/src/app/api/premium/today/route.ts:1-40` (402 + entitlement 게이트 — 그대로 소비)
- **E1 (Event-driven, WHEN):** WHEN 인증·권한 있는 사용자가 학습 홈에 진입하면, THEN 시스템은 `/api/premium/today`로 오늘 세션(리딩 1편 + 세그먼트 N)을 가져와 렌더링해야 한다.
- **E2 (Event-driven, WHEN):** WHEN 사용자가 리스닝 세그먼트를 재생하면, THEN 시스템은 임베드 플레이어로 `start/end` 구간만 재생하고 트랜스크립트를 싱크하며 탭/클릭-투-글로스를 제공해야 한다.
  - Reference: `apps/mobile/src/lib/premium-transcript-sync.ts` (싱크 로직 이식 근거) · `apps/mobile/src/components/player/YouTubePlayer.tsx`
- **E3 (Event-driven, WHEN):** WHEN 사용자가 텍스트를 하이라이트하고 질문을 보내면, THEN 시스템은 `/api/premium/question`으로 짧은 답을 받아 표시하고 흐름 복귀를 보장하며 월 질문 캡 잔여를 반영해야 한다.
  - Reference: `apps/web/src/app/api/premium/question/` · `apps/web/src/lib/premium/question-cap.ts` (`MONTHLY_QUESTION_CAP`)
- **U2 (Unwanted, IF/THEN):** IF 학습 화면이 롤플레잉·표현 딥다이브 카드·6-스텝 단일 큐레이션 surface를 렌더링하려 한다면, THEN 시스템은 이를 노출하지 않아야 한다(v1.3 제외 surface 계승).
- **O1 (Optional, WHERE):** WHERE 세션이 아직 준비 중(preparing)인 경우, 시스템은 빈 세션 대신 준비중 상태를 표시할 수 있다.
  - Reference: `apps/web/src/app/api/premium/today/route.ts` (preparing 상태 주석)

### REQ-WEB-005 — 리마인드(카카오 알림톡 + 이메일) + 결제 안내 발송

목적: 학습 습관 리텐션과 결제 라이프사이클(체험 종료·결제 실패) 안내를 카카오 알림톡(정보성)으로 보내고, 실패 시 이메일로 폴백한다.
관련: 발송 벤더(O-1/O-2), Render Cron, dunning(REQ-WEB-003) 연계.

- **U1 (Ubiquitous):** 시스템은 항상 발송 메시지를 정보성(transactional)으로 구성해야 하며, 광고성 문구를 알림톡 템플릿에 포함하지 않아야 한다(사전심사 통과 요건).
- **E1 (Event-driven, WHEN):** WHEN 일일 학습 리마인드 시각이 도래하면, THEN 시스템은 대상 사용자에게 학습 리마인드 알림톡을 발송하고, 발송 실패 시 이메일로 폴백해야 한다.
  - Reference: 신규 Render Cron → 발송 어댑터(알림톡 primary, email fallback)
- **E2 (Event-driven, WHEN):** WHEN 무료체험 종료 임박(예: D-1) 또는 결제 실패가 발생하면, THEN 시스템은 해당 사용자에게 결제 전환/카드 변경 안내를 알림톡(실패 시 이메일)으로 발송해야 한다.
- **W1 (State-driven, WHILE):** WHILE 사용자가 리마인드 수신을 거부(opt-out)한 상태인 동안, THEN 시스템은 학습 리마인드를 발송하지 않아야 한다(단, 결제 실패 등 거래성 고지는 정책에 따라 예외 가능).
- **U2 (Unwanted, IF/THEN):** IF 알림톡 발송이 실패하고 이메일 폴백도 실패하면, THEN 시스템은 발송 실패를 로깅하고 재시도 큐 또는 운영 알림으로 에스컬레이션해야 한다(무한 재시도 금지).

---

## 4. Traceability

| 요구 모듈 | 목표 | 신규 산출물 | 핵심 재사용(KEEP) |
|---|---|---|---|
| REQ-WEB-001 웹 인증 | G1 | 로그인 핸들러, OAuth/OTP 콜백 라우트, 세션 게이트 | `utils/supabase/*`(server/client/middleware/api-auth), 모바일 `AuthContext` 패턴 |
| REQ-WEB-002 토스 빌링키 결제 | G2 | `api/billing/issue`, `subscriptions` 테이블, 토스 SDK 클라이언트, 결제 UI | `entitlement.ts`(trial 계승), `users.plan` |
| REQ-WEB-003 라이프사이클·웹훅 | G3 | `api/billing/webhook`, 월 갱신 Cron, dunning, 해지 | `entitlement.ts`, `subscriptions` |
| REQ-WEB-004 학습 화면 웹 | G4 | 학습 홈·세션·플레이어·하이라이트 질문 UI | `/api/premium/today,question,reading,sessions`, transcript-sync, YouTubePlayer, question-cap |
| REQ-WEB-005 리마인드·발송 | G5 | 알림톡/이메일 어댑터, 발송 Cron | push-notifications 패턴, Render Cron |

> **INVIOLABLE KEEP:** `utils/supabase/*`, `premium/entitlement.ts`, `/api/premium/*`(today·question·reading·sessions·vocab), `users.plan` 스키마, 모바일 RevenueCat 경로는 제거·변경하지 않는다. 웹 결제는 이들과 **독립적으로 추가**된다.

---

## 5. 배포 / 운영 (Render) — 비기능 요구

> D6에 따라 배포 타깃은 Render. 기존 `vercel.json`(서울 리전, cron)을 Render 구성으로 이전한다.

- **Web Service**: Next.js(monorepo `apps/web`) — Render Web Service. 빌드 `pnpm --filter web build`, 시작 `next start`(또는 standalone). `next.config.ts`의 `output: 'standalone'` 활용 가능.
  - Reference: `apps/web/next.config.ts`(standalone·보안헤더), `vercel.json`(이전 대상 cron·리전 참조)
- **Cron Jobs**(Render Cron): ① 리딩 배치 생성(기존 vercel cron 이전) ② 월 구독 자동결제 갱신(REQ-WEB-003-E1) ③ 일일 리마인드 발송(REQ-WEB-005-E1) ④ dunning 재시도. 각 cron은 `CRON_SECRET` 헤더로 보호.
- **환경변수(신규)**: `TOSS_SECRET_KEY`, `TOSS_CLIENT_KEY`(공개), `TOSS_WEBHOOK_SECRET`, 알림톡 벤더 키(O-1), 이메일 벤더 키(O-2), 기존 Supabase/Gemini 키 승계.
- **시크릿 관리**: 토스 시크릿 키·billingKey 관련 자격은 서버 환경변수로만. 클라이언트 번들 유입 금지(`NEXT_PUBLIC_*` 접두사 사용 금지 — 단 `TOSS_CLIENT_KEY`는 공개 키이므로 예외).
- **리전**: 한국 사용자 지연 최소화를 위해 가용 시 Singapore 등 인접 리전 선택.
- **헬스/모니터링**: 결제·웹훅·발송 실패에 대한 구조적 로깅 및 운영 알림(Sentry 등 기존 자산 활용).

> 상세 구현 순서·작업 분해는 `plan.md`, 인수 기준(테스트 가능 시나리오)은 `acceptance.md`에 정의한다(후속 작성).

---

## 6. 리스크 / 가정

- **빌링키 보안**: billingKey 유출 시 부정결제 위험 → 서버 전용 보관·RLS·로깅 필수(REQ-WEB-002-U2).
- **알림톡 템플릿 심사 지연**: 정보성 템플릿도 사전심사에 수일 소요 가능 → 출시 일정에 버퍼. 이메일 폴백으로 위험 분산.
- **체험→유료 전환 마찰**: 무료체험 종료 시점 결제 유도 UX가 전환율을 좌우 → D-1 안내(REQ-WEB-005-E2).
- **결제 멱등성/중복과금**: 네트워크 재시도·중복 웹훅 대비 멱등키 필수(REQ-WEB-002-U4, REQ-WEB-003-U1).
- **가정**: 토스페이먼츠 가맹점 계약·정기결제(빌링) 사용 승인이 완료되어 있다(미완 시 사전 선행 작업).
- **가정**: 세션 조립 API(`/api/premium/today` 등)는 웹 클라이언트가 그대로 소비 가능한 인증 모델(쿠키 세션)을 지원한다 — 모바일 Bearer 토큰과 동일 게이트가 SSR 쿠키 세션에서도 동작하는지 run phase 초기에 검증 필요.
