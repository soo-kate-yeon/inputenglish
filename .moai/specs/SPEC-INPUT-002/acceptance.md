# SPEC-INPUT-002 인수 기준 (acceptance.md)

> 각 요구 모듈(REQ-AUTO-001~005)별 Given/When/Then 시나리오 2개 이상 + 엣지 케이스. 방법론 = **TDD**(tests-first). 근거: `spec.md` EARS 요구, `plan.md` 페이징·아키텍처, SPEC-INPUT-001 코드(ground truth).

---

## REQ-AUTO-001 — Agentic 영상 인제스트 (트리거 + 번역 + 스코어 완성)

### AC-001-1 (단일 트리거 → 완성 체인)
- **Given** 운영자가 화이트리스트 채널 영상의 유튜브 링크와 `channelId`를 트리거로 제출한다
- **When** 시스템이 인제스트를 실행한다
- **Then** 트랜스크립트 fetch → per-line 한국어 번역 → 세그먼트 분할 → 난도·`band_coverage`·`topic_tags` 스코어 → `video_segments` 영속이 하나의 체인으로 완료되고, 삽입된 세그먼트 id 목록이 반환된다 (REQ-AUTO-001-E1)

### AC-001-2 (번역 채움)
- **Given** 인제스트된 세그먼트의 `transcript` 라인들이 한국어 번역 전이다
- **When** 시스템이 번역 단계를 실행한다
- **Then** 각 라인의 `translation` 필드가 자연스러운 구어체 한국어로 채워져 영속되고, 빈 `translation`을 가진 라인이 없다 (REQ-AUTO-001-U1)

### AC-001-3 (band_coverage / topic_tags 채움)
- **Given** 한 세그먼트의 트랜스크립트가 분할 완료되었다
- **When** 시스템이 스코어 단계를 실행한다
- **Then** `band_coverage`가 밴드별 어휘 커버리지 jsonb로(빈 `{}` 아님), `topic_tags`가 주제 태그 배열로(빈 `[]` 아님) 채워져 영속된다 (REQ-AUTO-001-U2)

### 엣지 케이스
- **EC-001-A (부분 실패 격리):** 한 세그먼트의 번역/스코어/삽입이 실패해도 나머지 세그먼트 인제스트는 계속되고 전체가 중단되지 않는다 (REQ-AUTO-001-W1, `ingest/route.ts:128-131` 패턴).
- **EC-001-B (self_contained 승급):** `isSelfContained()`가 정규식 휴리스틱 또는 Gemini 판정으로 `self_contained`를 산출하고, 앞을 가리키는 세그먼트("아까 그것…")는 `false`로 표기된다 (REQ-AUTO-001-W2, `segment-scorer.ts:53` `@MX:TODO`).
- **EC-001-C (비-어드민 거절):** 트리거 요청자가 어드민이 아니면 인제스트가 실행되지 않고 인증 오류가 반환된다 (REQ-AUTO-001-U3, `requireAdmin()` 게이트).
- **EC-001-D (LLM/yt-dlp 미설정 폴백):** 번역/트랜스크립트 제공자 미설정 시 fixture-mode로 안전하게 격리되고 크래시하지 않는다.

---

## REQ-AUTO-002 — 일일 리딩 배치 (밴드 × 포맷 × 토픽 풀)

### AC-002-1 (매트릭스 순회 풀 생성)
- **Given** 매트릭스가 밴드 4 × 포맷 6 × 토픽 M으로 정의되어 있다
- **When** 일일 리딩 배치가 트리거된다
- **Then** 각 셀에 대해 `generateReadingPiece()`가 호출되고, 결과가 풀 row(`user_id = NULL`, `band` 지정)로 `reading_pieces`에 영속된다 (REQ-AUTO-002-E1/U1)

### AC-002-2 (풀 row는 항상 user_id NULL)
- **Given** 배치가 한 셀의 리딩을 생성한다
- **When** 시스템이 풀 row를 영속한다
- **Then** 해당 row의 `user_id`가 `NULL`이고 `band`가 셀 밴드와 일치한다. 특정 사용자로 `user_id`를 채우려는 시도는 거부된다 (REQ-AUTO-002-U3)

### AC-002-3 (dedup/로테이션)
- **Given** 같은 (밴드 × 포맷 × 토픽) 셀에 최근 생성물이 존재한다
- **When** 배치가 같은 셀을 다시 생성한다
- **Then** 최근 N개와 중복/반복되지 않는 토픽·내용으로 생성되거나 토픽이 로테이션된다 (REQ-AUTO-002-E2)

### 엣지 케이스
- **EC-002-A (게이트 탈락 격리):** 슬롭(픽션)·grounding(논픽션)·커버리지 게이트를 통과 못 한 row는 `validation_status`로 격리되고 발행 풀(`approved`)에 포함되지 않는다 (REQ-AUTO-002-W1, `reading-generation.ts:240-260`).
- **EC-002-B (staleness):** `expires_at` 경과 또는 staleness 정책에 걸린 풀 row는 조립 대상에서 제외된다 (REQ-AUTO-002-U2).
- **EC-002-C (비용 상한):** 배치 1회 LLM 호출 수가 (밴드 × 포맷 × 토픽 × 재시도≤2)를 초과하지 않으며 DAU와 무관하다 (REQ-AUTO-002 ↔ REQ-AUTO-004-U2).

---

## REQ-AUTO-003 — 레벨-aware 세션 조립 (밴드 필터 + 폴백)

### AC-003-1 (밴드 필터 조립)
- **Given** entitlement 보유 사용자(밴드 = `conversation`)가 오늘 세션을 요청하고 `ci_sessions` 캐시가 미스다
- **When** 시스템이 세션을 조립한다
- **Then** `conversation` 밴드 풀 리딩 1편 + `conversation` 밴드 필터된 세그먼트 N개가 조립되어 `ci_sessions`에 영속·반환된다. 레벨 무시 랜덤 선택이 일어나지 않는다 (REQ-AUTO-003-E1/U1)

### AC-003-2 (풀 리딩 우선)
- **Given** 풀 리딩(`user_id IS NULL` + 밴드 일치)과 per-user 리딩(`user_id = 사용자`)이 모두 존재한다
- **When** 시스템이 리딩을 선택한다
- **Then** 풀 row가 1차 소스로 우선 선택된다 (REQ-AUTO-003-U2, `today/route.ts:81-95` 교체)

### AC-003-3 (캐시 idempotency)
- **Given** 사용자가 오늘 이미 세션을 받았다(`ci_sessions`에 해당 날짜 row 존재)
- **When** 사용자가 같은 날 다시 요청한다
- **Then** 풀 재조립·LLM 재호출 없이 캐시된 세션이 반환된다 (REQ-AUTO-003-U4, `ci_sessions` UNIQUE(user,date))

### 엣지 케이스
- **EC-003-A (얕은 풀 → 인접 밴드 폴백):** 사용자 밴드 풀이 요청 세그먼트 수를 못 채우면 ±1 밴드로 폴백하여 가용분을 조립하고, 빈 세션을 반환하지 않는다 (REQ-AUTO-003-W1).
- **EC-003-B (완전 고갈 → "준비 중"):** 사용자 밴드와 인접 밴드 모두 풀이 비어 0개 조립이 되면, 빈 배열/크래시 대신 명시적 "준비 중" 상태가 반환된다 (REQ-AUTO-003-U3).
- **EC-003-C (밴드 해석 폴백):** `user_vocab_profiles`가 없으면 온보딩 `level_band`로 사용자 밴드를 해석한다.

---

## REQ-AUTO-004 — 스케줄링 & 비용 (Vercel Cron)

### AC-004-1 (스케줄 트리거)
- **Given** `vercel.json`에 일일 리딩 배치 Cron이 설정되어 있다
- **When** 스케줄된 시각이 도래한다
- **Then** Vercel Cron이 엔트리포인트 라우트를 호출하여 일일 리딩 배치(REQ-AUTO-002)가 실행된다 (REQ-AUTO-004-E1, `vercel.json:25-29` crons 추가)

### AC-004-2 (Cron 인증)
- **Given** 외부 호출자가 Cron 엔트리포인트를 직접 호출한다
- **When** 요청에 유효한 `CRON_SECRET`/Vercel Cron 헤더가 없다
- **Then** 배치가 실행되지 않고 인증 오류가 반환된다 (REQ-AUTO-004-U1)

### AC-004-3 (밴드 비례 비용)
- **Given** DAU가 100명인 환경과 10만명인 환경
- **When** 일일 리딩 배치가 각각 실행된다
- **Then** 두 환경의 일일 리딩 생성 LLM 호출 수가 동일하다(밴드 × 포맷 × 토픽 × 재시도, 사용자 무관) (REQ-AUTO-004-U2)

### 엣지 케이스
- **EC-004-A (idempotency):** 같은 날 Cron이 중복 실행돼도 `(run_date, band, format, topic)` 키로 풀이 이중 생성되지 않는다 (REQ-AUTO-004-W1).
- **EC-004-B (Hobby 플랜 한도 폴백):** Vercel cron 빈도/개수 한도로 필요한 스케줄을 못 채우면 단일 Cron 내부 루프 또는 Supabase scheduled function으로 강등되어 한도를 위반하지 않는다 (REQ-AUTO-004-U3).
- **EC-004-C (채널 폴링 Cron, 선택):** 활성화 시 화이트리스트 신규 영상이 별도 Cron으로 자동 인제스트된다 (REQ-AUTO-004-O1).

---

## REQ-AUTO-005 — 레거시 Freeze 제약

### AC-005-1 (v1.3 테이블만 대상)
- **Given** 자동화 파이프라인(인제스트·배치·조립·Cron)이 실행된다
- **When** 콘텐츠를 읽거나 쓴다
- **Then** 대상이 v1.3 테이블(`reading_pieces`·`video_segments`·`channels`·`ci_sessions`)에 한정되고, 레거시 테이블에는 접근하지 않는다 (REQ-AUTO-005-U1)

### AC-005-2 (레거시 도달 불가)
- **Given** 자동화 코드 경로가 빌드·실행된다
- **When** 정적 가드(테스트/lint)가 import·query 그래프를 검사한다
- **Then** 레거시 테이블(`premium_sessions`/`premium_articles`/`premium_expression_cards`)·레거시 어드민 UI(`admin/premium/page.tsx`)·deprecated 타입(`PremiumArticle`/`PremiumExpressionCard`/`PremiumRoleplay`/`PREMIUM_SESSION_STEPS`)에 대한 참조가 0건이다 (REQ-AUTO-005-U2)

### 엣지 케이스
- **EC-005-A (제거는 별도 트랙):** deprecated 타입의 실제 코드 제거가 본 SPEC에서 일어나지 않고 INPUT-001 Stage B(3)에 위임됨이 확인된다 (REQ-AUTO-005-U3).
- **EC-005-B (레거시 어드민 무손상):** 본 SPEC 작업 후에도 `admin/premium/page.tsx`(2,106줄)가 편집·삭제되지 않고 그대로 freeze 상태로 남는다.

---

## 품질 게이트 기준 (TRUST 5 + TDD)

- **Tested:** 모든 요구 모듈은 tests-first(TDD RED→GREEN→REFACTOR). 커밋당 최소 커버리지 80%(`quality.yaml min_coverage_per_commit`), 목표 85%. 구현보다 먼저 작성된 테스트가 아니면 거부.
- **Fixture-mode:** 인제스트(yt-dlp/번역)·리딩 생성·배치는 fixture-mode 테스트로 LLM/외부 호출 격리(`reading-generation.ts:178-202` 패턴 계승).
- **비용 상한 검증:** 일일 배치 LLM 호출 수가 밴드 비례(사용자 무관)임을 테스트로 보증(REQ-AUTO-004-U2 / EC-002-C).
- **풀 row 불변식:** 모든 풀 `reading_pieces` row가 `user_id IS NULL`임을 테스트로 보증(REQ-AUTO-002-U3).
- **레벨-aware 보증:** 세션 조립이 밴드 필터를 거치고 순수 랜덤이 아님을 테스트로 보증(REQ-AUTO-003-U1).
- **레거시 freeze 가드:** 자동화 코드의 레거시 import·query 0건을 정적 가드로 보증(REQ-AUTO-005-U2).
- **서버 게이트:** 인제스트·Cron = 서버 전용 인증(admin/CRON_SECRET). 세션 = entitlement + RLS(INPUT-001 KEEP). 402/401·미인증 경로 테스트.
- **LSP 게이트(run):** errors 0, type errors 0, lint errors 0 (`quality.yaml lsp_quality_gates.run`).
- **Secured:** 콘텐츠 테이블 서버 전용 RLS(`reading_pieces` `service_role_only` KEEP), `ci_sessions` self_only KEEP, 신규 인덱스 추가만.
- **Definition of Done:** REQ-AUTO-001~005의 모든 AC + 엣지 케이스 통과, 밴드-풀 아키텍처 동작(호출=밴드비례), 레거시 freeze 무손상, INPUT-001 KEEP 부품(ingest/translate/today/reading-generation/segment-scorer/vocab-band) 불가침 유지.
