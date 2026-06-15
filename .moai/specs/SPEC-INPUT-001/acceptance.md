# SPEC-INPUT-001 인수 기준 (acceptance.md)

> 각 요구 모듈(REQ-INPUT-001~005)별 Given/When/Then 시나리오 2개 이상 + 엣지 케이스. 방법론 = **TDD**(tests-first). 근거: `spec.md` EARS 요구, `plan.md` 페이징, PRD v1.3, research.md.

---

## REQ-INPUT-001 — 수준 모델 + 최소 레벨 시드

### AC-001-1 (band-seed → 초기 known-word set)
- **Given** 사용자가 온보딩에서 `level_band = conversation`을 선택했고 아직 known-word set이 비어 있다
- **When** 시스템이 `UserVocabProfile`을 초기화한다
- **Then** known-word set이 `conversation` 밴드 추정값(해당 빈도 밴드까지 known)으로 채워지고, `estimated_band = conversation`이 단일 레코드로 저장된다

### AC-001-2 (탭-투-글로스 = 난도 센서)
- **Given** 사용자가 리딩을 읽는 중이고 `UserVocabProfile`이 존재한다
- **When** 사용자가 단어 `"ubiquitous"`를 탭하여 글로스를 요청한다
- **Then** `"ubiquitous"`가 "모름 신호"로 기록되고 known-word set 갱신 이력(`source = tap`)에 반영된다

### AC-001-3 (자가보정 루프)
- **Given** 오늘 콘텐츠의 모르는 단어 비율이 12%로 측정되었다
- **When** 시스템이 다음 콘텐츠를 추천한다
- **Then** 추천 난도가 한 단계 낮아진다 (10% 초과 → 난도↓). 반대로 0%이면 난도↑

### 엣지 케이스
- **EC-001-A (밴드 이탈 → 난도 재조정):** 콘텐츠 모르는 단어 비율이 목표(2~5%)를 벗어나면(예: 0% 또는 12%) 다음 추천 난도가 자동 조정된다 (REQ-INPUT-001-W1).
- **EC-001-B (첫 3~5일 탐색):** 사용 첫 3~5일 윈도우에서는 시스템이 추정 밴드를 의도적으로 흔들어 수렴을 가속한다 (REQ-INPUT-001-W2).
- **EC-001-C (글로스 중복 탭):** 동일 단어 반복 탭 시 known-word 판정·이력이 idempotent하게 갱신되고 행이 폭발하지 않는다.

---

## REQ-INPUT-002 — 리딩 트랙: 온디맨드 생성 1편

### AC-002-1 (레벨×관심사×포맷 생성)
- **Given** 사용자 추정 레벨 = B1, 관심사 = "coffee supply chain", 포맷 = "noir 단편"
- **When** 시스템이 리딩 생성을 요청한다
- **Then** 해당 레벨·관심사·포맷의 단일 `ReadingPiece`가 생성되어 반환된다

### AC-002-2 (커버리지 자동 검증)
- **Given** `ReadingPiece` 생성이 완료되었다
- **When** 시스템이 known-word set 대조로 모르는 단어 커버리지를 계산한다
- **Then** 모르는 단어 비율이 2~5% 목표 안이면 발행 가능, 벗어나면 재생성/난도 재조정된다

### AC-002-3 (픽션 슬롭 검수)
- **Given** 포맷이 픽션이고 생성 텍스트에 "피어나다"가 포함되었다
- **When** 시스템이 anti-slop 검수(`findPremiumCopySlop`)를 실행한다
- **Then** 슬롭 검수에서 탈락하고 해당 piece는 사용자에게 노출되지 않는다

### 엣지 케이스
- **EC-002-A (커버리지 out-of-band → 난도 재조정):** 모르는 단어 비율이 8%(목표 초과)면 piece가 발행되지 않고 난도를 낮춰 재생성한다 (REQ-INPUT-002-E1/U2).
- **EC-002-B (논픽션 grounding 누락):** 사실 소스 없이 생성된 논픽션 piece는 grounding 검수에서 탈락하고 노출되지 않는다 (REQ-INPUT-002-W2/U2).
- **EC-002-C (LLM 미설정 폴백):** `GEMINI_API_KEY`/`AZURE_OPENAI_*` 미설정 시 폴백 stub로 안전하게 대체되고 크래시하지 않는다 (`expression-card-ai.ts:383-435` 패턴).

---

## REQ-INPUT-003 — 리스닝 트랙: 세그먼트 인덱스 + 임베드 플레이어

### AC-003-1 (화이트리스트 인덱싱)
- **Given** 어떤 영상이 화이트리스트 `Channel`에 속하지 않는다
- **When** 시스템이 리스닝 후보를 인덱싱한다
- **Then** 비-화이트리스트 영상은 인덱싱되지 않는다 (REQ-INPUT-003-U1)

### AC-003-2 (세그먼트 난도 스코어 + 재생)
- **Given** 화이트리스트 영상의 트랜스크립트 인제스트가 완료되었다
- **When** 시스템이 난도 스코어를 산출하고 사용자가 한 세그먼트를 재생한다
- **Then** 세그먼트에 어휘 커버리지(95~98%)+wpm 점수가 부착되고, 플레이어가 `start/end` 구간만 재생하며 트랜스크립트가 100ms로 싱크되고 탭-글로스가 활성화된다

### AC-003-3 (자족성 게이트)
- **Given** 한 세그먼트가 "아까 그것…"처럼 앞을 가리킨다
- **When** LLM이 transcript로 자족성을 판정한다
- **Then** 해당 세그먼트는 추천되지 않는다 (REQ-INPUT-003-W1)

### 엣지 케이스
- **EC-003-A (ASR-only transcript → gloss 경고):** 사람 자막이 없고 ASR 전용이며 글로스 품질 상속이 보장되지 않으면, 글로스 품질 경고를 표기하거나 세그먼트를 강등한다 (REQ-INPUT-003-U3).
- **EC-003-B (긴 먹통 구간):** 평균 in-band이지만 긴 out-of-band 패치가 있는 세그먼트는 레벨 게이트에서 탈락한다.
- **EC-003-C (영화·애니 임베드 불가):** 임베드 저작권 벽이 있는 소스는 인덱싱 대상에서 분리된다(별도 칸, Out).

---

## REQ-INPUT-004 — 하이라이트 질문 에이전트 + 질문 히스토리

### AC-004-1 (하이라이트 → 짧은 답 → return-to-flow)
- **Given** 사용자가 세그먼트 자막에서 `"pull it off"`를 하이라이트하고 질문한다
- **When** 시스템이 질문 에이전트를 호출한다
- **Then** 뜻·뉘앙스·용법의 **짧은 답**이 반환되고 사용자는 input 흐름(다시 듣기/읽기)으로 복귀한다 (REQ-INPUT-004-E1)

### AC-004-2 (AskedItem 영속 + 히스토리 탭)
- **Given** 사용자가 질문을 보내 답을 받았다
- **When** 사용자가 질문 히스토리 탭을 연다
- **Then** `AskedItem`(하이라이트 텍스트 + 질문 + 답변 + source 위치 + timestamp)이 재열람용으로 표시된다 (REQ-INPUT-004-U1/E2)

### AC-004-3 (월 캡 긍정형 표시)
- **Given** 사용자의 이번 달 질문 잔여가 12개다
- **When** 사용자가 질문을 보낸다
- **Then** 질문이 처리되고 "이번 달 질문 11개 남음"이 긍정형으로 표시된다 (REQ-INPUT-004-W1)

### 엣지 케이스
- **EC-004-A (질문 캡 소진 → graceful):** 월 캡이 0이면 추가 질문은 graceful하게 거절되고(흐름 차단·크래시 없이) 다음 달 리셋 안내가 표시된다 (REQ-INPUT-004-U3).
- **EC-004-B (모델 티어링):** 평소 경량 모델로 응답하되 복잡 질문은 상위 모델로 승급한다 (REQ-INPUT-004-U2).
- **EC-004-C (퀴즈·카드 없음):** 질문 히스토리는 재열람 전용 — 회상 퀴즈/딥다이브 카드 surface가 붙지 않는다(PRD §6.5, Non-Goal).

---

## REQ-INPUT-005 — 세션 조립 v1 + 서버 entitlement + 레거시 정리 제약

### AC-005-1 (읽기 1 + 세그먼트 N 조립)
- **Given** entitlement를 보유한 사용자가 오늘 세션을 요청한다
- **When** 시스템이 세션을 조립한다
- **Then** `{reading_piece, segments[]}`(읽기 1편 + 세그먼트 N개)가 묶여 반환된다 (REQ-INPUT-005-E1)

### AC-005-2 (서버 entitlement 게이트 → 402)
- **Given** entitlement가 없는(혹은 trial 만료) 사용자가 세션 콘텐츠를 요청한다
- **When** 서버가 `resolvePremiumEntitlement`로 게이트한다
- **Then** 콘텐츠 대신 402가 반환되고 콘텐츠 바디는 노출되지 않는다 (REQ-INPUT-005-U1)

### AC-005-3 (removed surface → not reachable)
- **Given** v1.3 세션/홈/라우트가 렌더링된다
- **When** 사용자가 세션을 탐색한다
- **Then** roleplay·expression-card 딥다이브·6-스텝 단일 큐레이션 surface는 어디에서도 도달 불가하다 (REQ-INPUT-005-U2)

### 엣지 케이스
- **EC-005-A (entitlement 없음 → 402):** 미인증·미보유 요청에 402/401이 반환되고 콘텐츠가 새지 않는다 (REQ-INPUT-005-U1/U3).
- **EC-005-B (RLS 차단):** 콘텐츠 테이블 직접 SELECT(서버 외)가 RLS로 거부되고, 사용자 소유 테이블은 타인 row 접근이 거부된다 (REQ-INPUT-005-U4).
- **EC-005-C (PREMIUM drop 안전):** `premium_expression_cards`/`premium_articles` drop 마이그레이션이 데이터 미운영 전제에서 실행되며 잔여 참조가 컴파일·런타임을 깨지 않는다 (Stage B(4)).
- **EC-005-D (KEEP 불가침):** Stage A/B 제거 후에도 voice-rules·youtube-transcript·YouTubePlayer·transcript-sync·entitlement·repository/supabase-store·HighlightBottomSheet·onboarding band-seed가 그대로 동작한다 (research §3.3, §8.1).

---

## 품질 게이트 기준 (TRUST 5 + TDD)

- **Tested:** 모든 요구 모듈은 tests-first(TDD RED→GREEN→REFACTOR). 커밋당 최소 커버리지 80%(`quality.yaml min_coverage_per_commit`), 목표 85%. 구현 코드보다 먼저 작성된 테스트가 아니면 거부.
- **Fixture-mode:** 각 Phase는 fixture-mode 테스트(`premium-api.ts:69-99` 패턴)를 동반하며 dev-only로 격리된다.
- **서버 게이트:** 세션 콘텐츠 접근은 서버사이드 entitlement + RLS로 강제(client-only 금지). 402/401 경로 테스트 필수.
- **Removed surface 도달 불가:** roleplay/expression-card/6-step surface가 어떤 네비게이션·라우트로도 도달되지 않음을 테스트로 보증.
- **LSP 게이트(run):** errors 0, type errors 0, lint errors 0 (`quality.yaml lsp_quality_gates.run`).
- **Secured:** 신규 사용자 소유 테이블 본인-전용 RLS, 콘텐츠 테이블 서버 전용 RLS. Bearer 인증 경로 검증.
- **Definition of Done:** 5개 요구 모듈의 모든 AC + 엣지 케이스 통과, Stage A/B/C 완료(KEEP 불가침 유지), PREMIUM-001 status `Superseded`.
