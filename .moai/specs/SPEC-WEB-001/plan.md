# SPEC-WEB-001 구현 계획 (plan.md)

> 근거: `spec.md`(EARS 요구 REQ-WEB-001~008, 결정 D1~D16), **PRD v1.4**(source of truth), 코드베이스 launch-readiness 분석(2026-06-30). 방법론 = **TDD**(`.moai/config/sections/quality.yaml` `development_mode: tdd`). 각 Phase는 fixture-mode 테스트 + 서버 entitlement 게이트를 동반한다.
> 일정 표현은 시간 단위 대신 우선순위·의존 순서(Primary/Secondary/Final Goal)로 기술한다.
> PG = **토스페이먼츠**(사용자 지정, PRD의 PortOne 미채택). 배포 = **Render**.

---

## 1. 페이징 개요 (의존 순서)

```
Phase 0 (기반: 데이터 모델 + 4→7밴드 확장 + Render 스캐폴드)   ← Primary
   ├─ Phase 1 (웹 인증 + SSR 세션 검증 스파이크)               ← Primary
   │     └─ [게이트] /api/premium/* 가 쿠키 세션으로 동작 검증
   ├─ Phase 2 (토스 결제 + 약정 구독 + 7일 체험 + 자동갱신)     ← Secondary
   ├─ Phase 3 (IL 7밴드 자가배치 + 온보딩)                      ← Secondary
   ├─ Phase 4 (화이트리스트 + 세그먼트 인덱스 + script_clean)   ← Secondary
   ├─ Phase 5 (일일 사다리 학습 UI + 코스×밴드 격자 + 세션)     ← Secondary
   ├─ Phase 6 (주간 예습자료 생성·발송)                         ← Final
   ├─ Phase 7 (카톡+이메일 리마인드: Solapi+Resend 어댑터)      ← Final
   └─ Phase 8 (Render 배포 마감 + Cron 4종 + 모니터링)          ← Final
```

각 Phase 사이에 타입 컴파일·`pnpm test` 그린을 게이트로 둔다. **INVIOLABLE KEEP**(`utils/supabase/*`, `entitlement.ts`, `/api/premium/*`, `youtube-transcript.ts`, transcript-sync, YouTubePlayer, question-cap, iframe 임베드 원칙)은 어느 Phase에서도 제거·변형하지 않는다.

### 크리티컬 선검증 (Phase 1 게이트)
`spec.md §6 가정`: 세션 API(`/api/premium/today` 등)는 모바일 **Bearer 토큰**용으로 작성됨(`requireApiUser`). 웹은 **쿠키 세션**이므로, Phase 1에서 *가장 먼저* "SSR 쿠키 세션으로 `/api/premium/today` 200 응답"을 검증하는 스파이크를 둔다. 실패 시 `api-auth.ts`에 쿠키 세션 인증 경로를 추가하는 작업이 Phase 1에 포함된다(스코프 변동 리스크).

---

## 2. 데이터 모델 델타 (Phase 0)

PRD §10 엔티티 기준. 기존 `users`(plan 컬럼)·세그먼트 인프라 위에 증분.

| 테이블/컬럼 | 작업 | 근거 |
|---|---|---|
| `users` / `UserProfile` | IL 인덱스(1.0~7.0 float), 어휘추정, 선택 코스 컬럼 추가. 기존 `plan` 유지 | REQ-WEB-002-U1, §10 |
| `il_band` 확장 | 기존 4밴드(level_band) → **IL 7밴드** 매핑 테이블 + 마이그레이션(시드 호환) | D5, §0.2 가정 |
| `subscriptions` (신규) | user_id, 약정종류(연/반년/3개월), 시작·만료일, 상태, **billing_key**(암호화), customer_key, 다음갱신일 | REQ-WEB-008 |
| `channels` 확장 | IL 밴드, 시각·억양·화자수·register 사람태그, **legal_status**(공식/임베드/대형IP) | REQ-WEB-003-U1, §10 |
| `video_segments` 확장 | **script_clean**(읽기용 클린본), 자막의존단계, IL | REQ-WEB-003-U2, D7 |
| `courses` (신규) | 도메인 레인, IL 범위, before/after 목표, 서사 프레임 | REQ-WEB-005-U1 |
| `weekly_prep` (신규) | 주차, 코스, 추출 어휘·표현, 소스 문장, 발송 상태 | REQ-WEB-006 |
| `asked_items` | (INPUT-001과 공유) 하이라이트·질문·응답·source | REQ-WEB-004-E3 |
| `daily_question_counts` (신규/뷰) | user_id, date, count — 하루 10회 캡 집계 | D15, REQ-WEB-004-W2 |
| `referrals` (신규, 자리만) | 추천코드·추천인·피추천인 (O-1 Deferred — 스키마만, 지급 미구현) | REQ-WEB-008-O1 |

> RLS: `subscriptions`/`weekly_prep`/`asked_items`/`daily_question_counts`는 본인 SELECT·서버 WRITE. `channels`/`video_segments`/`courses`는 서버 전용(public SELECT 없음). `billing_key`는 클라이언트 반환 절대 금지.

---

## 3. 빌드 Phase 분해

### Phase 0 — 기반 (Primary Goal)
- **Task 0.1** §2 마이그레이션 작성(subscriptions·courses·weekly_prep·daily_question_counts·referrals + channels/video_segments/users 컬럼 확장 + IL 7밴드 매핑).
- **Task 0.2** shared 타입 추가/확장: `UserProfile`(IL float), `Subscription`, `Course`, `WeeklyPrep`, `Channel`(legal_status), `VideoSegment`(script_clean). 기존 INPUT 타입과 충돌 없이 확장.
- **Task 0.3** 4밴드→7밴드 시드 호환 매핑 + 마이그레이션 데이터 백필.
- **Task 0.4** Render 스캐폴드: `render.yaml`(Web Service + Cron 4종 placeholder), 환경변수 목록 문서화(`TOSS_*`, `SOLAPI_*`, `RESEND_API_KEY`).
- **TDD:** 마이그레이션 적용·타입 컴파일·매핑 함수 테스트(RED→GREEN).

### Phase 1 — 웹 인증 + SSR 세션 (Primary Goal) · REQ-WEB-001
- **Task 1.0 (선검증 스파이크)** SSR 쿠키 세션으로 `/api/premium/today` 호출 → 인증·entitlement 통과 검증. 실패 시 Task 1.4로.
- **Task 1.1** `login/page.tsx` 3개 CTA에 핸들러 부착: Google·Apple OAuth(PKCE), 이메일 OTP/매직링크. 모바일 `AuthContext` provider 목록 이식.
- **Task 1.2** OAuth/OTP 콜백 라우트(`app/auth/callback/route.ts`) — 세션 수립 + `UserProfile` upsert(plan=FREE, created_at=now) + 온보딩/홈 분기.
- **Task 1.3** 미들웨어 보호 경로 게이팅(비로그인 → /login), 보호 API 401.
- **Task 1.4 (조건부)** `api-auth.ts`에 쿠키 세션 인증 경로 추가(Task 1.0 실패 시).
- **TDD:** 콜백 upsert·세션 게이트·401 테스트 우선.

### Phase 2 — 토스 결제 + 약정 구독 (Secondary Goal) · REQ-WEB-008
- **Task 2.1** 가격·약정 서버 상수(연 79k/반년 49k/3개월 29k, 서버 확정). 클라이언트 금액 불신뢰.
- **Task 2.2** 결제 플로우: 토스 SDK 위젯 → `api/billing/confirm`(서버 `POST /v1/payments/confirm` 검증) → 성공 시 `subscriptions`·entitlement 활성화. 멱등키.
- **Task 2.3** 자동갱신 빌링키: 카드 등록 → `api/billing/issue`(authKey→billingKey 교환·암호화 저장).
- **Task 2.4** 웹훅 수신 `api/billing/webhook` — 서명/출처 검증 → 구독·plan 동기화.
- **Task 2.5** 7일 무료체험: `entitlement.ts` 7일 trial 계승(1회), 체험 잔여·전환 CTA.
- **Task 2.6** 자동갱신 Cron(Phase 8 등록): 만료일 도래 → 사전고지 → billingKey 자동결제 → 만료일 갱신.
- **Task 2.7** `referrals` 스키마 자리만(지급 미구현, O-1 Deferred).
- **TDD:** confirm 검증·멱등·웹훅 서명검증·trial 판별·갱신 결제 테스트 우선. 토스 API는 모킹.

### Phase 3 — IL 7밴드 자가배치 + 온보딩 (Secondary Goal) · REQ-WEB-002
- **Task 3.1** 밴드 자가배치 UI: 7밴드 카드 + 20~30초 임베드 샘플클립("편하다/버겁다"). 앞면=실존 콘텐츠 앵커.
- **Task 3.2** 어휘진단(빈도밴드 yes/no + pseudoword + 적응형) → IL 시작점 교차검증. **엇갈리면 낮은 쪽**.
- **Task 3.3** 코스 선택(뉴스 1종) → `UserProfile` 시드.
- **Task 3.4** 런타임 탭센서 IL 소수점 미세조정(목표 탭률 2~5%) — INPUT-001 탭신호 재사용.
- **TDD:** 교차검증 낮은쪽 선택·IL 소수점 보정 테스트 우선.

### Phase 4 — 화이트리스트 + 세그먼트 인덱스 (Secondary Goal) · REQ-WEB-003
- **Task 4.1** `channels` 화이트리스트 입력·관리(어드민) + IL/사람태그/legal_status.
- **Task 4.2** 입장규칙 3줄 검증 로직(공식채널·임베드활성·대형IP제외) — 위반 시 인덱싱 차단.
- **Task 4.3** 세그먼트 인제스트 확장: `script_clean` 생성(난도상한 콘텐츠 클리닝), 자막의존단계, 리스닝 임계(≈98~99%/낮은 wpm) 스코어. `youtube-transcript.ts` 재사용.
- **Task 4.4** 자족성 게이트(앞 가리킴 탐지) → 미통과 비추천.
- **TDD:** 입장규칙 차단·리스닝 임계·자족성 게이트 테스트 우선.

### Phase 5 — 일일 사다리 학습 UI + 코스×밴드 격자 (Secondary Goal) · REQ-WEB-004/005
- **Task 5.1** 코스×밴드 격자 모델 + 세션 조립(IL×코스 레인 매칭·랭킹, fun 최종랭커). `/api/premium/today` 확장/소비. 빈 칸 비노출.
- **Task 5.2** 학습 홈(웹) — entitlement 게이트 → 오늘 세션(리딩=script_clean + 세그먼트 N).
- **Task 5.3** 유연 사다리 UI: 0 예습 → 1 RWL(자막ON·탭글로스) → 2 무자막. 어려운 콘텐츠만 0.5 스크립트 선행읽기. 유튜브 iframe + 위/옆 레이어(자체 플레이어 금지).
- **Task 5.4** RWL↔무자막 전환: **시스템 주도**(난도모델 판단), 토글은 보조. transcript-sync·YouTubePlayer 웹 이식.
- **Task 5.5** 하이라이트 질문: `/api/premium/question` 소비 + AskedItem 영속 + **하루 10회 캡**(`daily_question_counts`, 잔여 긍정표시, 소진 시 완곡/경량강등). 짧은 답=Flash 우선 라우팅.
- **Task 5.6** 질문 히스토리 탭. (카드·퀴즈 surface 금지 — U3.)
- **TDD:** 격자 빈칸 비노출·entitlement 402·캡 10회·시스템주도 전환 테스트 우선.

### Phase 6 — 주간 예습자료 (Final Goal) · REQ-WEB-006
- **Task 6.1** 트랜스크립트→핵심 어휘·표현 추출(밴드 맞춤, 실제 문장 묶음). 단순 단어나열 거부.
- **Task 6.2** 웹 제공·관리 + PDF 다운로드.
- **Task 6.3** 발송(일요일 Cron) + 발송 상태 기록.
- **TDD:** 맥락 묶음 검수·발송상태 테스트 우선.

### Phase 7 — 리마인드 (Final Goal) · REQ-WEB-007
- **Task 7.1** 발송 어댑터(단일 인터페이스): **Solapi 알림톡 primary → Resend 이메일 fallback**.
- **Task 7.2** 본문 생성: 주제 호기심 먼저 + 가치완결(미클릭 시 표현 1개 도달). 정보성 톤(광고성 금지).
- **Task 7.3** opt-out 처리, 둘 다 실패 시 로깅·운영 에스컬레이션(무한재시도 금지).
- **Task 7.4** 알림톡 템플릿 사전심사 제출(정보성).
- **TDD:** 폴백 체인·opt-out·실패 에스컬레이션 테스트 우선(벤더 API 모킹).

### Phase 8 — Render 배포 마감 (Final Goal) · §5
- **Task 8.1** `render.yaml` 확정: Web Service(standalone) + Cron 4종(예습발송·일일리마인드·약정갱신·인제스트). `CRON_SECRET` 보호.
- **Task 8.2** 환경변수 주입(`TOSS_*`/`SOLAPI_*`/`RESEND_*`/Supabase/Gemini). 결제·발송 시크릿 서버 전용.
- **Task 8.3** 모니터링(결제·웹훅·발송 실패 구조적 로깅 + Sentry).
- **Task 8.4** 기존 Vercel cron → Render Cron 이전 확인.

---

## 4. 마이그레이션 목록 (Phase 0)

신규 테이블: `subscriptions`, `courses`, `weekly_prep`, `daily_question_counts`, `referrals`.
컬럼 확장: `users`(il_index float·vocab_estimate·selected_course), `channels`(legal_status·사람태그), `video_segments`(script_clean·subtitle_dependency_stage·il).
매핑/백필: 4밴드 level_band → IL 7밴드 시드 호환.
RLS: §2 주석대로 본인 SELECT / 서버 WRITE / 콘텐츠 서버전용.

---

## 5. 리스크 · 게이트 (spec.md §6 연동)

- **SSR 세션 ↔ /api/premium 게이트(최우선)** — Phase 1 Task 1.0 스파이크로 선검증. 실패 시 Task 1.4 스코프 추가.
- **billingKey 보안** — 서버 전용 암호화 저장·RLS·로깅. 클라이언트 반환 금지(Task 2.3).
- **4→7밴드 마이그레이션** — 기존 데이터 시드 호환(Task 0.3). 무손실 백필 검증 게이트.
- **알림톡 템플릿 심사 지연** — Phase 7 Task 7.4 조기 제출, 이메일 폴백으로 출시 비차단.
- **토스 가맹·빌링 승인 선행** — 미완 시 Phase 2 블로킹(외부 의존).
- **ARPU 박리(연 79k)** — 발송·생성 원가 모니터링(Task 8.3) → 단위 마진 추적(PRD §11).

> 인수 기준(Given/When/Then)은 `acceptance.md` 참조.
