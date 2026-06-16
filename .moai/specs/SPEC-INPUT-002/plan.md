# SPEC-INPUT-002 구현 계획 (plan.md)

> 근거: `spec.md` EARS 요구, SPEC-INPUT-001 코드베이스(plan phase ground truth). 방법론 = **TDD**(`.moai/config/sections/quality.yaml` `development_mode: tdd`). 각 빌드 Phase는 fixture-mode 테스트 + 서버 인증 게이트를 동반한다.
> 일정 표현은 시간 단위 대신 우선순위·의존 순서(Primary/Secondary/Final Goal)로 기술한다.

---

## 1. 아키텍처 결정: 밴드-레벨 콘텐츠 POOL + per-user assembly (D3)

> Philosopher 프레임워크 적용: assumption audit → first principles → alternatives → trade-off → 결정. 본 결정은 사용자가 확정(D3)했으며, 본 절은 그 근거·대안·트레이드오프를 기록한다.

### 1.1 First principle

Comprehensible Input의 핵심 단위는 "**사용자 밴드에 맞는 콘텐츠**"이지 "**그 사용자만을 위한 콘텐츠**"가 아니다. 같은 밴드(예: `conversation`/B1)의 두 사용자는 같은 리딩·세그먼트를 **공유해도** comprehension density가 동일하게 성립한다. 따라서 콘텐츠의 자연 단위는 *사용자*가 아니라 *밴드*다.

### 1.2 대안 비교 (Diverge → Converge)

| 옵션 | 설명 | LLM 호출/일 | 다양성 | 트레이드오프 |
|---|---|---|---|---|
| **A. per-user 사전생성** | 사용자마다 매일 리딩 N편 미리 생성 | O(사용자 수 × N) | 최고(완전 개인화) | 비용 폭발 — 1만 유저면 1만×N 호출/일. 채택 불가(D3 거부) |
| **B. 온디맨드 per-user (현행 INPUT-001)** | 요청 시점에 그 사용자용 생성 | O(DAU × N) | 높음 | 비용은 DAU 비례 + 콜드 스타트 지연 + 풀/다양성/dedup 없음. 현행 갭(§1.2-2) |
| **C. 밴드-레벨 공유 풀 + per-user 조립 ★채택** | 밴드×포맷×토픽 매트릭스로 풀 사전생성, 사용자는 풀에서 밴드 매칭 조립 | **O(밴드 4 × 포맷 N × 토픽 M)** — 사용자 수 무관 | 충분(밴드 내 로테이션) | 개인화 입도는 밴드 단위(개별 토픽 취향은 조립 랭킹으로 보강). 콜드 스타트 없음(풀 미리 채움) |

### 1.3 채택 근거 (Trade-off)

- **얻는 것:** LLM 호출이 **사용자 수와 무관**(밴드 4 × 포맷 N × 토픽 M로 상한 고정). DAU가 100명이든 10만명이든 일일 생성 비용이 같다(REQ-AUTO-004-U2). 콜드 스타트 제거(풀이 미리 차 있음). dedup/로테이션을 배치 단계에서 중앙 관리.
- **희생:** 개인화 입도가 밴드 단위로 떨어진다(개별 사용자 토픽 취향은 per-user 사전생성만큼 정밀하지 않음). → **보강:** 세션 조립(REQ-AUTO-003)에서 사용자 관심사 기반 랭킹으로 풀 내 선택을 정렬, INPUT-001의 질문 에이전트(per-user, 월 캡)가 개인화를 담당.
- **왜 수용 가능한가:** Krashen i+1은 *밴드 매칭*만 요구하지 *개인 전용 텍스트*를 요구하지 않는다(§1.1). 비용 통제가 프리미엄 SaaS 마진의 1차 제약이고, 밴드 단위 풀이 이를 사용자 수로부터 디커플링한다.

### 1.4 현행 코드와의 정합

현행 `ci_sessions`는 이미 per-user-per-day(`UNIQUE(user_id, session_date)`, `supabase/migrations/20260615000700_ci_sessions.sql:9`)다 — **조립 결과만 per-user 캐시**하고 **소스는 공유 풀**이라는 본 아키텍처와 정확히 일치한다. 바꿀 것은 풀 *소스*(랜덤→밴드필터, per-user 리딩→풀 리딩)이지 캐시 구조가 아니다.

---

## 2. 데이터 모델 델타 (현행 마이그레이션 기준)

> 현행 스키마는 plan phase 확인. 변경은 **확장만**(레거시 freeze, KEEP 불가침).

### 2.1 `reading_pieces` — 풀화 (REQ-AUTO-002)

현행(`supabase/migrations/20260615000300_reading_pieces.sql:1-12`): `id, level, format, topic, body, coverage_pct, validation_status, source_facts, user_id(nullable), created_at`.

| 변경 | 내용 | 사유 |
|---|---|---|
| ADD COLUMN | `band text` (beginner/basic/conversation/professional) | 밴드 매칭 풀 조회 키(현행 `level`은 CEFR 문자열로 자유형 — 밴드 인덱스 별도 필요) |
| 활용 | `user_id` nullable 유지 → 풀 row = `user_id IS NULL` | per-user 사전생성 금지(REQ-AUTO-002-U3), 풀/개인 구분 |
| ADD COLUMN | `expires_at timestamptz` (nullable) 또는 staleness 정책 | 풀 라이프사이클(REQ-AUTO-002-U2) |
| ADD INDEX | `(band, format, validation_status, created_at DESC) WHERE user_id IS NULL` | 풀 조립 조회·dedup·로테이션 가속 |
| RLS | 기존 `service_role_only`(`:15`) 유지 — 서버 전용 | 변경 없음(KEEP) |

### 2.2 `video_segments` — 채움 완성 (REQ-AUTO-001)

스키마 변경 없음. **현행 빈 placeholder를 채우는 것**이 본질.

| 필드 | 현행 | 변경 |
|---|---|---|
| `transcript[].translation` | 미채움(`ingest/route.ts:118` `transcript: lines`) | 한국어 번역 채움(REQ-AUTO-001-U1) |
| `band_coverage` | `{}` (`:120`) | 밴드별 커버리지 jsonb 산출(REQ-AUTO-001-U2) |
| `topic_tags` | `[]` (`:121`) | 트랜스크립트 기반 주제 태그(REQ-AUTO-001-U2) |
| `self_contained` | 정규식 휴리스틱(`segment-scorer.ts:55-60`) | 휴리스틱 유지 또는 Gemini LLM 승급(REQ-AUTO-001-W2) |
| ADD INDEX | (없음) | `(channel_id, self_contained, difficulty_score)` + `band_coverage` GIN — 밴드필터 조립 가속(REQ-AUTO-003) |

### 2.3 `ci_sessions` — 변경 없음 (조립 소스만 교체)

`UNIQUE(user_id, session_date)` + `self_only` RLS 유지(KEEP). `assembly_meta`에 조립 출처(`pool_band`, `fallback_band`, `pool_thin`) 메타 추가만.

### 2.4 `vercel.json` — Cron 추가 (REQ-AUTO-004)

`apps/web/vercel.json`에 `crons` 키 신규(현행 `functions`만 존재, `:25-29`). 엔트리포인트 라우트 + `maxDuration` 상향(배치 LLM 호출 시간).

---

## 3. 빌드 Phase 분해 (의존 순서)

### Phase 1 — Agentic 인제스트 완성 (Primary Goal, REQ-AUTO-001)
인제스트 체인이 가장 독립적이고(다른 Phase 의존 없음), 리스닝 풀의 품질 전제(번역/밴드커버리지 없으면 조립 무의미).

- **Task 1.1** 인제스트 체인에 per-line 번역 결선: `ingest/route.ts`가 세그먼트 분할 후 `translate/route.ts`의 `translateBatchWithFallback`(또는 그 추출 함수)을 호출해 `transcript[].translation` 채움. (라우트 직접 호출 대신 공유 함수로 추출 권장.)
- **Task 1.2** `band_coverage` 산출: 세그먼트 트랜스크립트 어휘를 `vocab-band.ts` 밴드 기준으로 분류해 밴드별 커버리지 jsonb 생성(현행 `{}` 교체).
- **Task 1.3** `topic_tags` 산출: 트랜스크립트 기반 주제 분류(키워드 또는 경량 LLM 1콜).
- **Task 1.4** `self_contained` 승급(선택): `segment-scorer.ts:53` `@MX:TODO` — 정규식 → Gemini 판정 옵션.
- **Task 1.5** 트리거 surface: 신규 **최소 어드민 surface 버튼**(레거시 `admin/premium/page.tsx`와 무관한 신규 경량 페이지) AND/OR 자율 에이전트 엔트리(`CRON_SECRET` 게이트). 레거시 어드민 재사용 금지(REQ-AUTO-005).
- **TDD:** 번역 채움·band_coverage 산출·topic_tags·부분 실패 격리 테스트 우선(RED) → 구현(GREEN). fixture-mode로 LLM/yt-dlp 격리.

### Phase 2 — 일일 리딩 배치 (Secondary Goal, REQ-AUTO-002)
풀 사전생성. Phase 3(조립)이 풀을 소비하므로 선행.

- **Task 2.1** `reading_pieces` 마이그레이션: `band` 컬럼 + `expires_at` + 풀 인덱스(`§2.1`).
- **Task 2.2** 매트릭스 정의 모듈: (밴드 4 × 포맷 6 × 토픽 N) 셀 + 밴드별 일일 볼륨 config. `vocab-band.ts` 밴드 + `reading-generation.ts` 포맷 재사용.
- **Task 2.3** 배치 실행기: 매트릭스 순회 → 셀마다 `generateReadingPiece({ band→level, format, topic, userId: 풀센티넬 })` → 풀 row(`user_id = NULL`, `band` 지정) 영속. `generateReadingPiece()` 시그니처는 KEEP(입력에 band 매핑만 추가).
- **Task 2.4** dedup/로테이션: 같은 셀 최근 N개 토픽 회피(REQ-AUTO-002-E2).
- **Task 2.5** 라이프사이클: `validation_status` 격리 + staleness(만료 정책)로 풀 위생.
- **TDD:** 매트릭스 셀 생성·풀 row `user_id=NULL` 강제·dedup·게이트 격리 테스트 우선.

### Phase 3 — 레벨-aware 세션 조립 (Secondary Goal, REQ-AUTO-003)
`today/route.ts`의 랜덤 선택 교체. Phase 1·2 산출(채워진 세그먼트 + 풀)에 의존.

- **Task 3.1** `fetchRandomSegments` 교체 → `fetchSegmentsForBand(band, count)`: `band_coverage`/`difficulty_score` 밴드 필터(`today/route.ts:97-112` 교체).
- **Task 3.2** `fetchLatestReadingPieceForUser` 보강 → `fetchPoolReadingForBand(band)`: 풀 row(`user_id IS NULL` + 밴드) 우선 조회(`:81-95` 보강).
- **Task 3.3** 폴백: 밴드 풀 얕을 때 ±1 밴드 폴백, 그래도 빈 경우 "준비 중" 상태(REQ-AUTO-003-W1/U3).
- **Task 3.4** `assembly_meta`에 조립 출처 메타 기록.
- **Task 3.5** 사용자 밴드 해석: INPUT-001 `user_vocab_profiles`(있으면) 또는 온보딩 `level_band` → 밴드.
- **TDD:** 밴드 필터 선택·폴백·빈 풀 "준비 중"·캐시 idempotency 테스트 우선.

### Phase 4 — 스케줄링 & 비용 (Final Goal, REQ-AUTO-004)
배치를 자동 구동. Phase 2(배치 실행기)에 의존.

- **Task 4.1** Cron 엔트리포인트 라우트: 배치 실행기(Task 2.3) 호출. `CRON_SECRET`/Vercel Cron 헤더 인증(REQ-AUTO-004-U1).
- **Task 4.2** `vercel.json` `crons` + `maxDuration` 설정(`§2.4`).
- **Task 4.3** idempotency: 실행일+셀 키로 중복 실행 풀 이중생성 방지(REQ-AUTO-004-W1).
- **Task 4.4** Hobby/Pro 플랜 분기: cron 빈도 한도 초과 시 단일 Cron 내부 루프 또는 Supabase scheduled function 폴백(REQ-AUTO-004-U3).
- **Task 4.5(선택)** 채널 폴링 Cron: 화이트리스트 신규 영상 자동 인제스트(REQ-AUTO-004-O1).
- **TDD:** Cron 인증·idempotency·비용 상한(호출수=밴드비례) 테스트 우선.

### 횡단 — 레거시 Freeze 가드 (REQ-AUTO-005, 전 Phase)
- **Task X.1** 자동화 코드 경로가 레거시 테이블/어드민/타입을 import·query하지 않음을 정적 가드(테스트 또는 lint 규칙)로 보증(REQ-AUTO-005-U2).

---

## 4. 스케줄링 & LLM 비용 모델 (REQ-AUTO-004)

### 4.1 일일 LLM 호출 추정 (밴드 비례, 사용자 무관)

```
리딩 배치/일 = 밴드(4) × 포맷(6) × 토픽(M) × 재시도(≤2)
            = 24M × (1~2)   ← M=토픽 수 (config)
예) M=3 → 72~144 생성 콜/일  (DAU와 무관)
인제스트/영상 = 번역 배치(N라인/12) + topic_tags(1) + self_contained(0~1)
            ← 트리거당, 사용자 무관
질문 에이전트 = per-user, 월 100회 소프트 캡 (INPUT-001 REQ-INPUT-004)
```

핵심: **per-user 생성 콜은 질문 에이전트(월 캡)뿐**. 리딩·세그먼트 공급은 밴드 상한 고정(REQ-AUTO-004-U2). DAU 10배 증가해도 생성 비용 불변.

### 4.2 Vercel Cron 플랜 제약 (Hobby vs Pro)

| 항목 | Hobby | Pro |
|---|---|---|
| Cron 빈도 | 제한적(일 단위 권장, 분 단위 미보장) | 분 단위까지 |
| Cron 개수 | 소수 | 다수 |
| 함수 maxDuration | 짧음 | 김(배치 LLM에 유리) |

> 빈도/개수 한도가 본 배치를 못 받치면 **단일 일일 Cron이 내부 루프로 전 매트릭스 처리**하거나 **Supabase scheduled function**으로 폴백(REQ-AUTO-004-U3). 정확한 현행 플랜·한도는 `/moai:2-run`에서 운영 확인(WebFetch로 Vercel Cron 최신 한도 검증 권장).

### 4.3 idempotency

- 리딩 배치: `(run_date, band, format, topic)` 키로 같은 날 중복 생성 차단.
- 세션 조립: `ci_sessions` `UNIQUE(user_id, session_date)`가 이미 보장(KEEP).

---

## 5. 기술 스택 · 의존성 (production-stable only)

- **LLM:** 리딩 생성 = `gemini-2.5-pro`(`reading-generation.ts:143` `READING_GENERATION_MODEL`) → Azure 폴백 → fixture. 번역 = `gemini-2.5-flash`(`translate/route.ts:6`). topic_tags/self_contained = 경량 모델 1콜.
- **트랜스크립트:** yt-dlp + youtube-transcript-api 폴백(`youtube-transcript.ts`).
- **DB·RLS:** Supabase. 콘텐츠 테이블 서버 전용 RLS(`reading_pieces` `service_role_only` KEEP), `ci_sessions` self_only KEEP.
- **스케줄러:** Vercel Cron(`apps/web/vercel.json` `crons` 신규) — region `icn1`(`:7`). 대안: Supabase scheduled functions(`pg_cron`/Edge Function).
- **인증:** 인제스트·Cron = 서버 전용(`requireAdmin()` / `CRON_SECRET`). 세션 = `requireApiUser()` Bearer + entitlement(INPUT-001 KEEP).

> 버전 핀: 정확한 stable 버전·Vercel 플랜 한도는 `/moai:2-run`에서 code-builder가 WebFetch로 확정(현 시점 미핀).

---

## 6. 리스크 분석 · 대응

| # | 리스크 | 대응 |
|---|---|---|
| R1 | **LLM 비용 폭발** | 밴드-풀 아키텍처(D3)로 호출=밴드비례(REQ-AUTO-004-U2). per-user 생성은 질문 에이전트 월 캡뿐. `MAX_RETRIES=2` 상한(`reading-generation.ts:204`) |
| R2 | **콘텐츠 staleness/반복** | dedup/로테이션(REQ-AUTO-002-E2) + 셀 최근 N개 회피 + `expires_at` 라이프사이클(U2). 토픽 매트릭스 주기 로테이션 |
| R3 | **풀 starvation(고갈)** | ±1 밴드 폴백(REQ-AUTO-003-W1), 빈 경우 "준비 중"(U3). 배치 볼륨 config로 밴드별 최소 풀 유지. 모니터링: 밴드별 풀 깊이 알림 |
| R4 | **번역 품질** | `translate/route.ts` 자연 구어체 한국어 프롬프트(`:71-88`) 재사용 + 배치 실패 분할 폴백(`:145-167`). ASR-only 트랜스크립트는 글로스 품질 경고(INPUT-001 REQ-INPUT-003-U3 계승) |
| R5 | **Vercel Cron 플랜 한도(Hobby vs Pro)** | 단일 일일 Cron 내부 루프 또는 Supabase scheduled function 폴백(REQ-AUTO-004-U3). `/moai:2-run`에서 현행 플랜 확인 |
| R6 | **부분 실패(인제스트 체인)** | 세그먼트별 try-continue 격리(REQ-AUTO-001-W1, `ingest/route.ts:128-131` 계승). 한 세그먼트 실패가 전체 중단 안 함 |
| R7 | **레거시 누수** | freeze 가드(REQ-AUTO-005, Task X.1) — 자동화 코드가 레거시 테이블/타입 import·query 정적 차단 |
| R8 | **밴드 매핑 불일치** | `reading_pieces.level`(CEFR 자유형)과 밴드 4종 매핑 테이블 명시(`vocab-band.ts:27-32` cefrMap 재사용) |
| R9 | **배치 중복 실행** | idempotency 키(REQ-AUTO-004-W1) + `ci_sessions` UNIQUE 캐시 |

---

## 7. @MX 태그 타깃

- **`@MX:ANCHOR` 배치 실행기** — 일일 리딩 풀 생성 단일 진입점(public 경계, REQ-AUTO-002-E1). `@MX:REASON` 비용 상한 계약.
- **`@MX:ANCHOR fetchSegmentsForBand` / `fetchPoolReadingForBand`** — 세션 조립 풀 조회 단일 경로(`today/route.ts` 교체, fan_in from home).
- **`@MX:ANCHOR` Cron 엔트리포인트** — 외부 트리거 경계(REQ-AUTO-004-U1, 인증 계약). `@MX:REASON`.
- **`@MX:WARN`** — band_coverage 산출/매트릭스 순회(분기 복잡도 ≥15 가능) + LLM 폴백 경로(`@MX:REASON` 필수).
- **`@MX:NOTE`** — band↔level(CEFR) 매핑 규칙, 풀 dedup/로테이션 의도, 풀 row `user_id=NULL` 센티넬 의도.
- **`@MX:TODO`** — `segment-scorer.ts:53` self_contained LLM 승급(Task 1.4) + TDD RED 미구현 타깃.
- **기존 KEEP 태그 유지:** `today/route.ts:1-3`(`@MX:ANCHOR GET /api/premium/today`), `ingest/route.ts:1-2`, `segment-scorer.ts:1-2`, `reading-generation.ts:58-59`는 확장하되 ANCHOR 강등 금지.

---

상세 인수 기준·테스트 시나리오는 `acceptance.md`를 참조한다.
