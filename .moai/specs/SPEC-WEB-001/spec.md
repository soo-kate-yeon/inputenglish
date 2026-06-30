---
id: SPEC-WEB-001
version: 0.3.0
status: Planned
created: 2026-06-30
updated: 2026-06-30
author: soo-kate-yeon
priority: High
platform: web-primary
source_of_truth: inputeng_prd_v1.4.md
depends_on: SPEC-INPUT-001, SPEC-INPUT-002, SPEC-INPUT-003
---

# SPEC-WEB-001: 인풋영어 웹 구독 출시 (PRD v1.4 정렬)

> **단일 근거(Source of Truth) = PRD v1.4** (`inputeng_prd_v1.4.md`). 본 SPEC의 모든 제품 요구·범위·가격·콘텐츠 모델은 v1.4를 따른다. v1.4가 v1.3 기반 가정(SPEC-INPUT-*)과 충돌하는 경우 **v1.4가 우선**한다(§0 관계 참조).
> 코드 그라운딩: 백엔드 세션 조립 API·entitlement·Supabase 인증 인프라는 이미 존재하므로 재사용한다(KEEP). 신규 구축이 필요한 것은 웹 UI·결제(토스페이먼츠)·밴드 자가배치·주간 예습·리마인드 발송이다.
> Reference 인용은 `Reference: {file_path}:{line_range}` 또는 `PRD §{n}` 형식을 사용한다.

---

## HISTORY

- **v0.3.0 — 2026-06-30** — 미결 5건 확정: ① **7일 무료체험 1회 포함**(기존 trial 로직 계승), ② 약정 만료 **토스 빌링키 자동갱신**, ③ 친구추천 크레딧 = **후속 우선순위(deferred)**, ④ 발송 벤더 = **솔라피(알림톡) + Resend(이메일)** 추천 채택(1인 빌더·Cron 자동화 최적), ⑤ 질문 캡 = **횟수 아닌 월 ₩1,000 토큰비용 캡**(소프트). REQ-WEB-004/007/008 갱신.
- **v0.2.0 — 2026-06-30** — **PRD v1.4 전면 정렬.** 비즈니스 모델 개편 반영: ① 앱→웹, ② 결과보장·환불 제거, ③ IL 7밴드 직접선택, ④ 코스×밴드 격자(뉴스 1종 런칭), ⑤ 카톡+이메일 리마인드 + 주간 예습자료, ⑥ 연구독 우선 가격(연 79k/반년 49k/3개월 29k). **PG는 토스페이먼츠**(사용자 지정 — PRD의 PortOne 대신 토스 채택), ⑦ 생성 리딩 제거 → 리딩=그날 리스닝 콘텐츠 클린 스크립트(하나의 콘텐츠 유연 사다리). 요구 모듈 5개→8개로 확장. 가격·PG 충돌 2건을 §0.2에 명시.
- **v0.1.0 — 2026-06-30** — 초안(월 ₩4,900 + 토스페이먼츠 가정). v1.4 도입으로 supersede.

---

## 0. 관계 · 충돌 정리

### 0.1 v1.3 기반 SPEC과의 관계

SPEC-INPUT-001/002/003은 PRD v1.3을 단일 근거로 작성되었다. PRD v1.4는 v1.3을 다음 지점에서 **명시적으로 변경**하므로(PRD §0), 본 SPEC은 충돌 시 v1.4를 따른다. INPUT 시리즈의 엔진 내부(밴드 계산·세그먼트 스코어링·트랜스크립트 파이프라인)는 **여전히 유효하며 재사용(KEEP)**하되, 아래 델타는 본 SPEC이 갱신한다.

| 영역 | v1.3 (INPUT specs) | v1.4 (본 SPEC, 우선) |
|---|---|---|
| 가격 | 앱·3개월 약정 | **웹·연구독 우선**(연 79k/반년 49k/3개월 29k), 월 구독 없음 |
| 플랫폼 | iOS-primary | **web-primary**(앱·앱스토어 제거) |
| 리딩 | **생성** 리딩 1편(온디맨드) | **생성 리딩 제거** → 리딩 = 그날 리스닝 콘텐츠의 **클린 스크립트** 선행읽기 |
| 밴드 | 4밴드 band-seed(beginner/basic/conversation/professional) | **IL 7밴드** 직접선택(앞면 콘텐츠 앵커 + 뒷면 wpm·커버리지) |
| 결과보장 | (해당 없음) | **결과보장·환불·90일 측정 인프라 제거** |
| 사다리 | 리딩/리스닝 별도 두 엔진 | **하나의 콘텐츠 유연 사다리**(예습→[스크립트]→RWL→무자막) |
| 코스 | (없음) | **코스×밴드 격자**(뉴스 1종 런칭) |

> INPUT 시리즈 문서는 본 SPEC에서 편집하지 않는다. v1.4 정렬을 위한 INPUT 스펙 갱신은 별도 후속 작업으로 분리한다.

### 0.2 확인 필요 — 직전 대화와 PRD v1.4의 충돌 (사용자 확인 권장)

| # | 직전 대화 발화 | PRD v1.4 (source of truth) | 본 SPEC 채택 |
|---|---|---|---|
| C-1 | "월 4,900짜리 웹" | 월 구독 없음. 연 79,000 / 반년 49,000 / 3개월 29,000 **선불 약정**(PRD §4.4) | **v1.4 채택**(선불 약정). 월 ₩4,900 폐기 |
| C-2 | "PG는 토스페이먼츠" | 구독 결제 = **PortOne**(PRD §13, §14.2) | **토스페이먼츠 채택**(사용자 지정 우선). PRD의 PortOne은 미채택 — PG는 토스페이먼츠 직접 연동 |

---

## 결정된 기본값 (Resolved Decisions)

| # | 결정 항목 | 확정값 (PRD 근거) | 관련 REQ |
|---|-----------|--------|---------|
| D1 | 플랫폼/플레이어 | 반응형 웹 + 웹뷰 리더. 영상은 **유튜브 iframe 임베드 그대로**(자체 플레이어 금지=ToS), 동기자막·탭글로스·RWL토글은 영상 *위/옆* UI 레이어만(§6.3, §13) | REQ-WEB-004, REQ-WEB-005 |
| D2 | 가격/약정 | 연 79,000(메인) / 반년 49,000 / 3개월 29,000. **연구독 우선·월 구독 없음·선불 약정**(매몰비용 닻). 친구추천 크레딧 유지(§4.4) | REQ-WEB-008 |
| D3 | 결제 PG | **토스페이먼츠**(사용자 지정 — PRD의 PortOne 대신 토스 직접 연동). 약정 선불결제 + 만료 자동갱신은 빌링키. 결과보장·환불 없음(§4.2, §13) | REQ-WEB-008 |
| D4 | 인증 | Supabase Auth(웹) — Google·Apple·이메일. 모바일 `AuthContext` 패턴을 SSR 이식 | REQ-WEB-001 |
| D5 | 밴드 시스템 | **IL 7밴드**(앞면=실존 콘텐츠 앵커, 뒷면=어휘 커버리지×wpm 자동 + 시각·억양·화자수 사람태그). IL 인덱스 1.0~7.0 소수점. 3겹 자가배치(샘플클립→어휘테스트 교차→탭센서)(§6.1) | REQ-WEB-002 |
| D6 | 런칭 코스 | **뉴스 코스 1종**(IL 3→6 사다리). 화이트리스트 첫 소스군 = VOA/BBC Learning English → CNN10 → 표준 뉴스(§6.4, §14.5) | REQ-WEB-003, REQ-WEB-005 |
| D7 | 리딩 모델 | **생성 리딩 제거.** 리딩 = 그날 리스닝 세그먼트의 **클린 스크립트**(세그먼트 종속, 별도 생성물 아님)(§0⑦, §6.2, §13) | REQ-WEB-004 |
| D8 | 일일 사다리 | **유연 사다리.** 기본 3단(0 예습 → 1 RWL 자막ON·탭글로스 → 2 무자막). 어려운 콘텐츠만 0.5 스크립트 선행읽기 추가 4단(§6.2) | REQ-WEB-004 |
| D9 | 주간 리듬 | 일요일 예습자료 발송 → 평일 콘텐츠 타임라인 → 가치완결 리마인드(§4.3, §8) | REQ-WEB-006, REQ-WEB-007 |
| D10 | 리마인드 | 카톡 + 이메일. 가치완결형(안 눌러도 한 입) + **주제 스토리텔링 먼저**(§6.6, §12.0) | REQ-WEB-007 |
| D11 | 배포 | **Render**(Web Service + Cron). 기존 cron 이전 | §5 |
| D12 | 무료체험 | **7일 무료체험 1회**(사용자당 1회). 기존 `entitlement.ts` 7일 trial(created_at 기준 → 자연 1회) 계승. 체험 종료 시 결제 유도, 미결제 시 차단 | REQ-WEB-008 |
| D13 | 약정 자동갱신 | **토스페이먼츠 빌링키 자동갱신.** 약정 만료일에 저장 billingKey로 동일 약정 자동결제. 결제 전 사전 고지(정보성 알림톡/메일) | REQ-WEB-008-E3 |
| D14 | 발송 벤더 | **솔라피(Solapi) = 알림톡, Resend = 이메일.** 둘 다 HTTP API·Cron 친화, 1인 빌더 운영 부담 최소. 알림톡 실패 → 이메일 폴백 어댑터(§5, REQ-WEB-007) | REQ-WEB-007 |
| D15 | 질문 캡 | **횟수 캡 아님 — 월 ₩1,000 AI 토큰비용 소프트 캡**(사용자당). 질문마다 토큰 사용량×모델단가를 KRW로 누적, ₩1,000 초과 시 경량모델 강등·완곡 안내(하드 차단 아님). 다음 달 리셋 | REQ-WEB-004 |

### 미결 결정 (Open Decisions — 후속)

| # | 항목 | 상태 | 영향 |
|---|------|------|------|
| O-1 | 친구추천 크레딧 지급 방식 | **Deferred(후속 우선순위)** — 추천인 재등록 크레딧(현금환불 아님) 방향만 잠정. MVP 결제 플로우에서는 코드 자리만 두고 미구현 | REQ-WEB-008-O1 |
| O-2 | 가격 정책 최종 | 본 SPEC은 PRD v1.4(연 79k/반년 49k/3개월 29k) 채택. 직전 대화의 "월 4,900"과 충돌 — 미정정 시 v1.4 유지(§0.2-C1) | REQ-WEB-008 |

---

## 1. 배경 (Background)

### 1.1 v1.4 전환 핵심 (PRD §0)

인풋영어는 v1.4에서 **비즈니스 모델을 전면 개편**한다: 앱→웹(앱스토어 심사·30% 수수료·설치 마찰 제거), 결과보장·환불·90일 측정 인프라 제거(솔로 운영 과부하 + churn 비기여), IL 7밴드 직접선택, 코스×밴드 격자, 카톡+이메일 리마인드 + 주간 예습자료, 연구독 우선 가격, **생성 리딩 제거 → 리딩=리스닝 콘텐츠 스크립트**(하루=하나의 콘텐츠를 네 단계로 오르는 사다리). retention을 *측정 증명*이 아니라 *습관·체감·compelling*으로 전환한다.

### 1.2 한 줄 정의 (PRD §1)

**"네가 고른 밴드에 *정확히* 맞는 영어를, 매주 코스로. 웹에서, 카톡·메일로 챙겨주는."** 해자 두 축 = ① 밴드 매칭(기술) × ② "오늘 이거 안 열면 아까워"를 만드는 편집·카피(사람).

### 1.3 현황: 무엇이 되어 있고 무엇이 비는가 (코드베이스 분석)

**이미 존재(재사용·INVIOLABLE KEEP):**
- 유저용 세션 API + 서버 entitlement 게이트 — `/api/premium/{today,sessions,reading,question,vocab-*}`.
  - Reference: `apps/web/src/app/api/premium/today/route.ts:1-40` (`requireApiUser` + entitlement, 402)
  - Reference: `apps/web/src/lib/premium/entitlement.ts:20-58`
- 구독 상태 컬럼 `users.plan`(FREE/PREMIUM). (v1.4 약정 모델 반영 위해 확장 필요 — REQ-WEB-008)
  - Reference: `supabase/migrations/20260405100000_add_plan_column_to_users.sql`
- Supabase SSR 인증 유틸: `apps/web/src/utils/supabase/{server,client,middleware,api-auth}.ts`
- 유튜브 트랜스크립트 인제스트·세그먼트 파이프라인(어드민) + 싱크/플레이어(모바일, 웹 이식 근거).
  - Reference: `apps/web/src/lib/premium/youtube-transcript.ts`, `apps/mobile/src/lib/premium-transcript-sync.ts`, `apps/mobile/src/components/player/YouTubePlayer.tsx`

**비어 있음(본 SPEC이 채움):**
- 웹 유저 로그인(로그인 페이지가 핸들러 없는 껍데기). Reference: `apps/web/src/app/login/page.tsx:32-58`
- 토스페이먼츠 결제·약정 구독·친구추천. (toss 결제 코드 0건)
- IL 7밴드 자가배치 UI/모델(현행 4밴드 → 7밴드 확장)
- 유저용 학습 화면(웹) — 루트가 `/admin` 리다이렉트, 유저 surface 없음
- 주간 예습자료 생성·발송, 카톡+이메일 리마인드, 코스×밴드 격자, Render 배포

---

## 2. 목표 / 비목표 (Goals / Non-Goals)

### 2.1 Goals (수직 슬라이스 = 온보딩→주간리듬→일일학습→구독)

| # | 목표 | PRD |
|---|------|-----|
| G1 | 웹 인증: Google·Apple·이메일 실제 가입/로그인(SSR 세션) | §13 |
| G2 | IL 7밴드 자가배치 + 온보딩(샘플클립·어휘진단·코스선택) | §6.1, §7 |
| G3 | 리스닝 화이트리스트(법적 입장규칙 3줄) + 세그먼트 인덱스 + IL 태깅 | §6.3, §9 |
| G4 | 하루=하나의 콘텐츠 유연 사다리(클린스크립트 → RWL → 무자막) + 하이라이트 질문 | §6.2, §6.7 |
| G5 | 코스×밴드 격자(뉴스 1종) + 세션 조립 + 서버 entitlement | §6.4 |
| G6 | 주간 예습자료(워드집·표현집) 생성·웹제공·발송 | §6.5 |
| G7 | 카톡+이메일 리마인드(가치완결·주제 스토리텔링) | §6.6 |
| G8 | 토스페이먼츠 약정 구독(연/반년/3개월) + 친구추천 + entitlement 연동 | §4.4, §13 |

### 2.2 Non-Goals (PRD §13 Out / 후속)

- **결과보장·환불·90일 측정 인프라** — 제거(부활 안 함).
- **생성 리딩** — 저IL 니치 공급 보조·ER 볼륨 애드온으로만 후속.
- **PWA**(manifest·설치유도·오프라인) — Phase 2.
- **키즈 SKU**(부모 타깃, 별도 측정·규제·UX).
- **드라마·영화 외부 포인터 통합** / **IL 7 상급 코스**(다인 대화·빠른 무대본).
- **카드·회상 퀴즈·내 표현 사전 큐레이션** — AskedItem만 시드.
- **뉴스 외 코스**(자기계발·업계 팟캐스트·대학강의 등) — 상위 티어 후속.
- **모바일(RevenueCat) 경로** — 본 SPEC 범위 밖(현행 유지 또는 별도 처리).

---

## 3. EARS 요구사항

> EARS 5종: Ubiquitous(항상), Event-driven(WHEN), State-driven(WHILE), Optional(WHERE), Unwanted(IF/THEN ... shall not). 기술 식별자는 영어로 유지.

### REQ-WEB-001 — 웹 사용자 인증 / 계정

목적(PRD §13): 유저가 웹에서 실제 가입·로그인하고 SSR 세션을 유지. 모바일 `AuthContext` 패턴을 `@supabase/ssr`로 이식.

- **U1 (Ubiquitous):** 시스템은 항상 인증 사용자에 대해 SSR·API 양쪽에서 동일한 쿠키 기반 Supabase 세션을 유효하게 유지해야 한다.
  - Reference: `apps/web/src/utils/supabase/middleware.ts`, `api-auth.ts`(`requireApiUser`)
- **E1 (Event-driven, WHEN):** WHEN 사용자가 Google·Apple·이메일 중 하나를 선택하면, THEN 시스템은 해당 인증 플로우(OAuth PKCE 또는 이메일 OTP)를 개시해야 한다.
  - Reference: `apps/web/src/app/login/page.tsx:32-58`(핸들러 부착 대상)
- **E2 (Event-driven, WHEN):** WHEN 인증 콜백이 도착하면, THEN 시스템은 세션을 수립하고 `UserProfile`(없으면 생성: plan/약정 미설정, created_at=now)을 보장한 뒤 온보딩 또는 학습 홈으로 분기해야 한다.
- **W1 (State-driven, WHILE):** WHILE 사용자가 비로그인 상태인 동안, THEN 시스템은 학습·결제·계정 보호 경로 접근을 로그인으로 유도해야 한다(콘텐츠 미노출).
- **U2 (Unwanted, IF/THEN):** IF 세션이 만료·무효라면, THEN 시스템은 보호 API에 콘텐츠 대신 401을 반환하고 재로그인을 유도해야 한다.

### REQ-WEB-002 — IL 7밴드 자가배치 + 온보딩

목적(PRD §6.1, §7): 유저가 *실존 콘텐츠 앵커*로 자기 밴드를 직접 고르고, 어휘진단·탭센서가 객관화·수렴한다. 앞면(선택)/뒷면(계산) 분리, IL 1.0~7.0 소수점.

- **U1 (Ubiquitous):** 시스템은 항상 각 사용자에 대해 `UserProfile`에 IL 인덱스(1.0~7.0 소수점), 어휘 추정, known-word set, 선택 코스를 단일 레코드로 유지해야 한다(§10).
- **E1 (Event-driven, WHEN):** WHEN 온보딩 밴드 자가배치 단계에서 사용자가 밴드 카드의 20~30초 임베드 샘플 클립을 보고 "편하다/버겁다"를 선택하면, THEN 시스템은 그 선택을 IL 시작점 시드로 기록해야 한다(§6.1 1단).
- **E2 (Event-driven, WHEN):** WHEN 온보딩 어휘진단(빈도밴드 yes/no + pseudoword 앵커 + 적응형)이 완료되면, THEN 시스템은 자가선택과 교차검증하고, **엇갈리면 낮은 쪽에서 시작**해야 한다(§6.1 2단, 좌절=이탈 방지).
- **W1 (State-driven, WHILE):** WHILE 사용자가 콘텐츠를 소비하는 동안, THEN 시스템은 모르는 단어 비율(탭률, 목표 2~5%)로 IL 소수점을 자동 미세조정해야 한다(§6.1 3단).
- **U2 (Ubiquitous):** 시스템은 항상 밴드 앞면을 추상 라벨이 아닌 *실존 콘텐츠 앵커*(Peppa Pig / TED 등 §6.1 표)로 제시해야 한다.
- **U3 (Unwanted, IF/THEN):** IF 자가선택 IL이 어휘진단 추정보다 높게 엇갈린다면, THEN 시스템은 높은 쪽으로 시작하지 않아야 한다.

### REQ-WEB-003 — 리스닝 화이트리스트 + 법적 입장규칙 + 세그먼트 인덱스

목적(PRD §6.3, §9): 라이브 검색 아님 — 오프라인 인제스트 → 난도점수 → 세그먼트 인덱스. 화이트리스트=척추, 법적 방어선 3줄.

- **U1 (Ubiquitous):** 시스템은 항상 리스닝 후보를 `Channel` 화이트리스트 내에서만 인덱싱하고, 각 채널에 IL 밴드 + 시각·억양·화자수·register 사람태그 + `legal_status`를 부착해야 한다(§6.3, §10).
- **U2 (Ubiquitous):** 시스템은 항상 인덱스 단위를 영상이 아닌 `VideoSegment`(parent_video_id, start/end, transcript, **script_clean**, wpm, band coverage, IL, self_contained, 자막의존단계)로 저장해야 한다(§10).
  - Reference: `apps/web/src/lib/premium/youtube-transcript.ts`(자막·메타 인제스트 재사용)
- **E1 (Event-driven, WHEN):** WHEN 트랜스크립트 인제스트가 완료되면, THEN 시스템은 난도점수를 어휘 커버리지 + wpm으로 산출하되 **리스닝 임계를 리딩보다 높게(≈98~99% 또는 낮은 wpm)** 적용해야 한다(§6.3 모달리티 임계).
- **W1 (State-driven, WHILE):** WHILE 세그먼트가 자족성 게이트를 통과하지 못한 상태(앞을 가리킴)인 동안, THEN 시스템은 해당 세그먼트를 추천하지 않아야 한다(§6.3).
- **U3 (Unwanted, IF/THEN):** IF 채널이 ① 비공식/재업로드/편집본, ② 임베드 비활성, ③ 대형 엔터 IP(디즈니·픽사·마블·워너·유니버설 등) 중 하나라도 해당하면, THEN 시스템은 화이트리스트에 포함하지 않아야 한다(§6.3 입장규칙 3줄).
- **U4 (Unwanted, IF/THEN):** IF 영상을 유튜브 iframe이 아닌 자체 플레이어로 감싸 재생하려 한다면, THEN 시스템은 이를 수행하지 않아야 한다(ToS 위반 — §6.3, §13).

### REQ-WEB-004 — 하루=하나의 콘텐츠 유연 사다리 (클린스크립트·RWL·무자막·질문)

목적(PRD §6.2, §6.7): 하루 세션 = *하나의 리스닝 콘텐츠*를 난도를 올려가며 만나는 유연 사다리. 리딩 = 그날 세그먼트 클린 스크립트(생성 아님). 자막 의존도를 3번째 난도 축으로.

- **U1 (Ubiquitous):** 시스템은 항상 하루 학습을 하나의 콘텐츠 사다리로 구성해야 한다: 기본 3단(0 예습 → 1 RWL 자막ON·탭글로스 → 2 무자막)(§6.2, D8).
- **U2 (Ubiquitous):** 시스템은 항상 리딩 콘텐츠를 그날 세그먼트의 **클린 스크립트(`script_clean`)**로 제공해야 하며, 별도 생성 리딩을 만들지 않아야 한다(§0⑦, §6.2).
- **E1 (Event-driven, WHEN):** WHEN 사용자가 RWL(1단)을 재생하면, THEN 시스템은 유튜브 iframe으로 `start/end` 구간을 재생하고 트랜스크립트를 싱크하며 탭/클릭-투-글로스와 하이라이트 질문을 활성화해야 한다.
  - Reference: `apps/mobile/src/lib/premium-transcript-sync.ts`(싱크 이식), `YouTubePlayer.tsx`
- **E2 (Event-driven, WHEN):** WHEN 시스템의 난도 모델이 RWL→무자막 전환 시점으로 판단하면, THEN 시스템은 같은/인접 세그먼트의 무자막(2단)을 *시스템 주도로* 제시해야 한다(유저 토글에만 의존하지 않음). 토글은 보조(언제든 재ON)(§6.3 위닝).
- **W1 (State-driven, WHILE):** WHILE 콘텐츠가 IL 상한 근처이고 탭률이 높은 동안, THEN 시스템은 0.5단 **스크립트 선행읽기(클린본)**를 RWL 전에 안전망으로 꺼내야 한다(어려울 때만, 매일 강제 아님)(§6.2 4단).
- **E3 (Event-driven, WHEN):** WHEN 사용자가 텍스트를 하이라이트하고 질문을 보내면, THEN 시스템은 짧은 답(뜻·뉘앙스·용법)을 반환해 흐름 복귀를 보장하고 `AskedItem`으로 영속해야 한다(§6.7).
  - Reference: `apps/web/src/app/api/premium/question/`, `apps/web/src/lib/premium/question-cap.ts`(횟수→비용 기준으로 확장)
- **U4 (Ubiquitous):** 시스템은 항상 질문 응답마다 AI 토큰 사용량(input+output)을 모델 단가로 KRW 환산해 사용자별 당월 누적비용을 집계해야 한다(D15).
- **W2 (State-driven, WHILE):** WHILE 사용자의 당월 질문 토큰비용이 **₩1,000 이하**인 동안, THEN 시스템은 기본 모델로 질문을 처리하고 잔여 한도를 긍정형으로 표시해야 한다(D15).
- **U3 (Unwanted, IF/THEN):** IF 학습 화면이 카드·회상 퀴즈·내 표현 사전 큐레이션 surface를 노출하려 한다면, THEN 시스템은 이를 노출하지 않아야 한다(§13 Out, 능동 레이어=질문 히스토리만).
- **U5 (Unwanted, IF/THEN):** IF 사용자의 당월 질문 토큰비용이 ₩1,000 소프트 캡을 초과했다면, THEN 시스템은 질문을 하드 차단하지 않고 경량 모델로 강등하거나 완곡 안내(다음 달 리셋)를 표시해야 한다(D15).

### REQ-WEB-005 — 코스×밴드 격자 + 세션 조립 + 서버 entitlement

목적(PRD §6.4): 밴드=세로(난도), 코스=가로(주제). 코스 = 도메인 레인을 IL 사다리로 오르는 대각선 경로. 뉴스 1종 런칭. 채워진 칸만 노출.

- **U1 (Ubiquitous):** 시스템은 항상 코스를 (도메인 레인) + (before/after 목표) + (서사 프레임)으로 정의하고, 고정 커리큘럼이 아니라 레인 *안에서* i+1 선별을 유지해야 한다(§6.4).
- **E1 (Event-driven, WHEN):** WHEN 인증·권한 있는 사용자가 오늘 세션을 요청하면, THEN 시스템은 사용자 IL × 선택 코스 레인에서 세그먼트를 매칭·랭킹(fun 최종 랭커)해 `Session`(reading=클린스크립트 + [segment...])을 조립·반환해야 한다.
  - Reference: `apps/web/src/app/api/premium/today/route.ts`(조립 엔드포인트 소비/확장)
- **U2 (Ubiquitous):** 시스템은 항상 세션 콘텐츠 접근을 서버사이드 entitlement로 게이트하고, 권한 없는 요청에 콘텐츠를 반환하지 않아야 한다(§13 결과보장 제거와 무관하게 구독 게이트는 유지).
  - Reference: `apps/web/src/lib/premium/entitlement.ts:20-58`
- **W1 (State-driven, WHILE):** WHILE 격자 칸이 비어 있는 동안(예: IL 1 "업계 팟캐스트"), THEN 시스템은 그 칸을 사용자에게 노출하지 않아야 한다(§6.4).
- **U3 (Unwanted, IF/THEN):** IF 요청이 미인증이거나 구독 entitlement가 없다면, THEN 시스템은 콘텐츠 대신 결제/구독 안내를 반환해야 한다.
- **O1 (Optional, WHERE):** WHERE 코스 완주가 가까운 경우, 시스템은 다음 코스(재구매 동선)를 추천할 수 있다(§6.4 재구매 엔진).

### REQ-WEB-006 — 주간 예습자료 (프라이밍 1차 책임)

목적(PRD §6.5): 매주 타임라인 시작 전(일요일) 그 주 콘텐츠에서 뽑은 워드집·표현집 발송. 단순 단어 PDF 아님 — 밴드 맞춤·맥락(실제 문장) 묶음. 프라이밍 1차 책임.

- **E1 (Event-driven, WHEN):** WHEN 새 주차가 시작되면(일요일), THEN 시스템은 그 주 콘텐츠 트랜스크립트에서 핵심 어휘·표현을 추출해 밴드 맞춤 `WeeklyPrep`(워드집·표현집 + 소스 문장)을 생성해야 한다(§6.5, §9).
- **U1 (Ubiquitous):** 시스템은 항상 예습자료를 웹에서 제공·관리하고 다운로드(PDF 등) 가능하게 해야 하며, 각 항목을 그 주 실제 콘텐츠·실제 문장과 묶어야 한다(§6.5).
- **E2 (Event-driven, WHEN):** WHEN `WeeklyPrep`가 준비되면, THEN 시스템은 카톡·메일로 "이번 주 예습 나왔어요" + 핵심 표현 일부를 본문에 담아 발송하고 발송 상태를 기록해야 한다(§6.5, §10 WeeklyPrep.발송상태).
- **U2 (Unwanted, IF/THEN):** IF 예습자료가 밴드 맞춤·맥락 묶음 없이 단순 단어 나열이라면, THEN 시스템은 이를 발행하지 않아야 한다(프리미엄 정당화 핵심 — §6.5).

### REQ-WEB-007 — 리마인드 (카톡 + 이메일, 가치완결 + 주제 스토리텔링)

목적(PRD §6.6, §12.0): 부담이 아니라 선물. 안 눌러도 메시지 *안에서* 오늘 표현 1개·한 문장은 건진다. **영어보다 주제의 운을 먼저 띄운다.**

- **U1 (Ubiquitous):** 시스템은 항상 리마인드 메시지를 가치완결형(미클릭 시에도 표현 1개·한 문장 도달)으로 구성해야 한다(§6.6).
- **E1 (Event-driven, WHEN):** WHEN 일일 리마인드 시각이 도래하면, THEN 시스템은 *주제 호기심을 먼저 건드리는* 본문("오늘 BBC에서 이런 일이 있었는데—")으로 **솔라피 알림톡**을 발송하고, 실패 시 **Resend 이메일**로 폴백해야 한다(§6.6, §12.0, D14).
- **U2 (Ubiquitous):** 시스템은 항상 리마인드를 매일 과제부과("콘텐츠 왔어요 ✅")가 아닌 가치·호기심 톤으로 구성해야 한다(매일 해지 트리거 회피 — §6.6 근거).
- **W1 (State-driven, WHILE):** WHILE 사용자가 학습 리마인드 수신 거부(opt-out) 상태인 동안, THEN 시스템은 학습 리마인드를 발송하지 않아야 한다(거래성 고지는 정책상 예외 가능).
- **U3 (Unwanted, IF/THEN):** IF 카톡 발송과 이메일 폴백이 모두 실패하면, THEN 시스템은 실패를 로깅하고 운영 알림으로 에스컬레이션해야 한다(무한 재시도 금지).

### REQ-WEB-008 — 구독 결제 (토스페이먼츠 약정 + 친구추천 + 라이프사이클)

목적(PRD §4.4, §13): 연구독 우선 선불 약정(연 79k/반년 49k/3개월 29k). 결과보장·환불 없음. **토스페이먼츠 결제**(PG는 사용자 지정 — PRD의 PortOne 대신 토스 직접 연동). 친구추천 크레딧. 모든 금액·plan 판정은 서버.

- **U1 (Ubiquitous):** 시스템은 항상 구독을 3개 선불 약정(연 79,000 / 반년 49,000 / 3개월 29,000, KRW)으로만 제공하고, 월 구독을 제공하지 않아야 하며, 금액·약정기간을 서버에서 확정해야 한다(클라이언트 금액 불신뢰)(§4.4).
- **E1 (Event-driven, WHEN):** WHEN 사용자가 약정을 선택하고 토스페이먼츠 결제를 완료하면, THEN 시스템은 서버 결제 승인/검증(`POST /v1/payments/confirm`)을 통과한 경우에만 `UserProfile` 구독(약정길이·만료일)과 entitlement를 활성화해야 한다(§10, §13).
  - Reference: 신규 `apps/web/src/app/api/billing/{confirm,webhook}/route.ts`(생성 예정) · 토스페이먼츠 결제 승인 API
- **E2 (Event-driven, WHEN):** WHEN 토스페이먼츠 결제 상태 웹훅이 수신되면, THEN 시스템은 서명/출처를 검증한 뒤 구독·entitlement를 웹훅 사실에 동기화해야 한다.
- **E3 (Event-driven, WHEN):** WHEN 약정 결제 시 자동갱신 동의로 카드 등록이 완료되면, THEN 시스템은 토스 `authKey`를 서버에서 billingKey로 교환해 `customerKey`와 함께 안전하게 저장해야 한다(자동갱신용, D13).
  - Reference: 토스페이먼츠 빌링 발급 `POST /v1/billing/authorizations/issue`
- **W1 (State-driven, WHILE):** WHILE 사용자가 7일 무료체험 기간(사용자당 1회) 내인 동안, THEN 시스템은 결제 없이 콘텐츠 접근을 허용하되 체험 잔여일·결제 전환 CTA를 표시해야 한다(D12).
  - Reference: `apps/web/src/lib/premium/entitlement.ts:11,20-58`(`TRIAL_DAYS=7` 계승)
- **W2 (State-driven, WHILE):** WHILE 사용자의 약정이 활성(만료 전)인 동안, THEN 시스템은 유료 콘텐츠 접근을 허용하고 만료일·자동갱신 안내를 표시해야 한다.
- **E4 (Event-driven, WHEN):** WHEN 약정 만료일에 자동갱신이 예정되어 있으면, THEN 시스템은 사전 고지(정보성 알림톡/메일) 후 저장된 토스 빌링키로 동일 약정 자동결제를 승인하고 만료일을 갱신해야 한다(D13).
- **O1 (Optional, WHERE):** WHERE 사용자가 친구추천 코드로 가입한 경우, 시스템은 추천인에게 재등록 크레딧을 부여할 수 있다(현금환불 아님). **MVP에서는 코드 자리만 두고 미구현(O-1 Deferred)**(§4.4).
- **U2 (Unwanted, IF/THEN):** IF 토스페이먼츠 결제 승인/검증·웹훅 서명 검증에 실패하거나 중복 결제(멱등키 중복)라면, THEN 시스템은 구독/entitlement를 활성화하거나 중복 과금하지 않아야 한다.

---

## 4. Traceability

| 요구 모듈 | 목표 | PRD | 신규 데이터/산출물 | 핵심 재사용(KEEP) |
|---|---|---|---|---|
| REQ-WEB-001 웹 인증 | G1 | §13 | 로그인 핸들러·콜백·세션게이트 | `utils/supabase/*`, 모바일 AuthContext |
| REQ-WEB-002 IL 7밴드 온보딩 | G2 | §6.1, §7 | UserProfile(IL 1.0~7.0), 샘플클립·어휘진단·탭센서 | onboarding band-seed(4→7 확장) |
| REQ-WEB-003 화이트리스트·세그먼트 | G3 | §6.3, §9 | Channel(legal_status), VideoSegment(script_clean·자막의존단계) | youtube-transcript, 세그먼트 인덱스 |
| REQ-WEB-004 일일 사다리 | G4 | §6.2, §6.7 | 사다리 UI, RWL토글, 하이라이트 질문, AskedItem | transcript-sync, YouTubePlayer, question-cap |
| REQ-WEB-005 코스×밴드 격자 | G5 | §6.4 | Course, Session(조립), 격자 노출 | `/api/premium/today`, entitlement |
| REQ-WEB-006 주간 예습자료 | G6 | §6.5 | WeeklyPrep, PDF, 발송 | 트랜스크립트 어휘추출 파이프라인 |
| REQ-WEB-007 리마인드 | G7 | §6.6, §12.0 | 카톡/이메일 어댑터, 본문 생성, opt-out | push-notifications 패턴 |
| REQ-WEB-008 토스 구독 | G8 | §4.4, §13 | billing/confirm·webhook, 약정 구독, 친구추천 | entitlement, users.plan(확장) |

> **INVIOLABLE KEEP:** `utils/supabase/*`, `premium/entitlement.ts`, `/api/premium/*`, `youtube-transcript.ts`, transcript-sync, YouTubePlayer, question-cap. 화이트리스트 iframe 임베드 원칙·자족성 게이트는 변경하지 않는다.

---

## 5. 배포 / 운영 (Render) — 비기능 요구

- **Web Service**(Render): Next.js monorepo `apps/web`. 빌드 `pnpm --filter web build`, 시작 `next start`(standalone 활용 가능). Reference: `apps/web/next.config.ts`(standalone·보안헤더).
- **Cron Jobs**(Render Cron, `CRON_SECRET` 보호): ① 주간 예습자료 생성·발송(일요일, REQ-WEB-006) ② 일일 리마인드(REQ-WEB-007) ③ 약정 만료 **빌링키 자동갱신**/만료 처리 + 갱신 사전고지(REQ-WEB-008-E4) ④ 콘텐츠 인제스트 배치(기존 cron 이전).
- **환경변수(신규):** `TOSS_SECRET_KEY`·`TOSS_CLIENT_KEY`(공개)·`TOSS_WEBHOOK_SECRET`, `SOLAPI_API_KEY`·`SOLAPI_API_SECRET`(알림톡), `RESEND_API_KEY`(이메일), 기존 Supabase/Gemini 승계. 결제·발송 시크릿은 서버 전용(클라이언트 번들 유입 금지 — `TOSS_CLIENT_KEY`만 공개 예외).
- **발송 어댑터:** 알림톡(Solapi) primary → 이메일(Resend) fallback의 단일 추상 인터페이스. 둘 다 순수 HTTP API라 별도 인프라 없이 Cron에서 호출(1인 빌더 운영 부담 최소).
- **리전:** 한국 인접(가용 시) 선택.
- **모니터링:** 결제·웹훅·발송 실패 구조적 로깅 + 운영 알림(Sentry 등 기존 자산).

> 구현 순서·작업 분해는 `plan.md`, 테스트 가능 인수 기준은 `acceptance.md`에 정의(후속).

---

## 6. 리스크 / 가정 (PRD §12)

- **churn(최대 적)** — 앱 락인·보장 없음. 방어: 선불 약정 매몰비용, 코스 연속성, 가치완결 리마인드, compelling.
- **핵심 승부처는 기술이 아님(§12.0)** — 마케팅 실행 + 콘텐츠 큐레이션×스토리텔링(편집자·카피라이터 근육). 스펙은 이를 *가능케 하는* 시스템(리마인드 본문 생성·예습자료·밴드 매칭)만 책임.
- **유튜브 ToS·저작권** — iframe 임베드 유지, 입장규칙 3줄(REQ-WEB-003-U3/U4). IL 7 드라마·대형 IP MVP Out.
- **ARPU 압박** — 연 79k 박리. 화이트리스트·발송 자동화가 수익성 생명줄(§9, §4.4 마진 경고).
- **자동화 한계** — 시각·억양·화자수는 사람태그 의존(REQ-WEB-003-U1).
- **알림톡 템플릿 심사 지연** — 정보성도 사전심사 수일. 이메일 폴백으로 분산.
- **가정**: 토스페이먼츠 가맹·결제 사용 승인 완료(자동갱신 시 빌링 사용 승인 포함, 미완 시 선행). 세션 API가 SSR 쿠키 세션 인증을 그대로 지원(모바일 Bearer 동등) — run 초기 검증.
- **가정**: v1.4 IL 7밴드 확장이 기존 4밴드 데이터와 시드 호환(마이그레이션 필요 시 REQ-WEB-002에서 처리).
