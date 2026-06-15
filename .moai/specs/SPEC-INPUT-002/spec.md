---
id: SPEC-INPUT-002
version: 0.2.0
status: Implemented
created: 2026-06-15
updated: 2026-06-15
author: soo-kate-yeon
priority: High
lifecycle_level: spec-anchored
platform: web-backend, ios-consumer
related_specs: SPEC-INPUT-001
---

# SPEC-INPUT-002: 콘텐츠 자동화 레이어 (Content Automation Layer)

> 본 SPEC은 **SPEC-INPUT-001(v1.3 CI 엔진)** 위에 얹는 콘텐츠 공급 자동화 레이어다. INPUT-001이 정의·구현한 1차 프리미티브(`reading_pieces`·`video_segments`·`ci_sessions` 테이블, `POST /api/admin/premium/ingest`, `generateReadingPiece()`, `GET /api/premium/today`)를 **재사용·확장**하며, 레거시 프리미엄 모델(SPEC-PREMIUM-001)은 건드리지 않는다.
> 본 문서의 모든 코드 사실은 plan phase에서 코드베이스 전수 확인됨(이미 검증됨, ground truth로 취급). Reference 인용은 `Reference: {file_path}:{line_range}` 형식을 사용한다.

---

## HISTORY

- **v0.2.0 — 2026-06-15** — TDD 구현 완료(Phase 1~4 + Freeze 가드). REQ-AUTO-001 agentic 인제스트(per-line 한국어 번역·band_coverage·topic_tags·self_contained LLM 훅·CRON_SECRET 듀얼 인증), REQ-AUTO-002 일일 리딩 배치(밴드×포맷×토픽 풀, `user_id=NULL` 불변식, dedup, validation 격리), REQ-AUTO-003 레벨-aware 조립(밴드 필터·±1 폴백·"준비 중"·기존 버그 2건 수정), REQ-AUTO-004 Vercel Cron(fail-closed 인증·whole-batch idempotency·셀 윈도잉), REQ-AUTO-005 freeze 정적 가드. 마이그레이션 `20260615001000_reading_pieces_pool.sql`(band/expires_at/풀 인덱스) 로컬 적용·검증. 신규 테스트 100+ 통과, tsc 0, 신규 회귀 0. status: Implemented.
- **v0.1.0 — 2026-06-15** — 초안 작성. 통합 파이프라인(영상 agentic-ingest + 리딩 daily-batch + 레벨-aware 세션 조립)을 단일 자동화 SPEC으로 정의. 밴드-레벨 콘텐츠 POOL + per-user assembly 아키텍처 채택(LLM 비용 통제). 스케줄러 = Vercel Cron 기본 후보. 레거시 프리미엄 freeze를 명시적 비목표로 고정. author: soo-kate-yeon.

---

## 결정된 기본값 (Resolved Decisions)

본 SPEC 착수 전 사용자가 확정한 결정. 이하 EARS 요구사항은 이 값을 기준으로 기술된다.

| # | 결정 항목 | 확정값 | 관련 REQ |
|---|-----------|--------|---------|
| D1 | 범위 | **통합 파이프라인** — 영상 agentic-ingest + 리딩 daily-batch + 레벨-aware 세션 조립을 하나의 자동화 SPEC으로 설계. | 전체 |
| D2 | 레거시 어드민 | **Freeze then gradually remove** — v1.3 CI 엔진으로 일원화. 본 자동화는 레거시 프리미엄 모델(`premium_sessions`/`premium_articles`/`premium_expression_cards`)을 **확장하지 않는다**. deprecated 타입 정리는 별도 트랙(INPUT-001 Stage B(3)). | REQ-AUTO-005 |
| D3 | 콘텐츠 아키텍처 | **밴드-레벨 콘텐츠 POOL + per-user assembly** (per-user 사전생성 아님 — LLM 비용 통제). 현행 `ci_sessions`는 per-user-per-day(`UNIQUE(user_id, session_date)`)이므로 조립은 공유 풀에서 읽는다. | REQ-AUTO-002, REQ-AUTO-003 |
| D4 | 스케줄러 | **Vercel Cron 기본 후보**(앱이 이미 Vercel + Supabase). Supabase scheduled functions는 대안. | REQ-AUTO-004 |

---

## 1. 배경 (Background)

### 1.1 현재 아키텍처: 두 개의 병렬 콘텐츠 시스템

레포에는 콘텐츠 시스템이 **두 개** 공존한다(plan phase 확인).

- **레거시 프리미엄 (SPEC-PREMIUM-001, deprecation 중):** `premium_sessions` + `premium_articles` + `premium_expression_cards` 테이블. `apps/web/src/app/admin/premium/page.tsx`(2,106줄 어드민 UI)에서 **수동 저작**: 유튜브 붙여넣기 → 트랜스크립트 로드 → 번역 → 수동 편집 → 아티클/표현카드/롤플레이 AI 초안 → 사람 리뷰 → 발행. 출력 타입(`PremiumArticle`·`PremiumExpressionCard`·`PremiumRoleplay`·`PREMIUM_SESSION_STEPS`)은 전부 `@deprecated`.
- **신규 v1.3 CI 엔진 (SPEC-INPUT-001, 사용자가 실제로 보는 것):** `reading_pieces` + `video_segments` + `ci_sessions` 테이블. `GET /api/premium/today`·`POST /api/premium/reading`·`POST /api/premium/question`이 소비.

### 1.2 문제: v1.3 엔진은 "자동 공급"이 비어 있다

INPUT-001은 콘텐츠를 *생성/스코어/조립*하는 1차 프리미티브를 만들었지만, **자동으로 공급하는 층이 없다**. 세 가지 갭이 확인된다(plan phase ground truth).

1. **영상 인제스트에 트리거가 없다.** `POST /api/admin/premium/ingest`는 트랜스크립트 fetch → 60~120s 세그먼트 분할 → WPM·난도(1~5)·자족성 스코어 → `video_segments` 영속까지 자동화되어 있으나, **UI 트리거가 없고**(어드민 surface 미존재), `translation`(한국어 글로스) 필드를 **채우지 않는다**.
   - Reference: `apps/web/src/app/api/admin/premium/ingest/route.ts:70-146` (인제스트 본체 — `transcript: lines` 삽입, `band_coverage: {}`·`topic_tags: []` 빈 placeholder, `unknownRatio = 0` 하드코딩)
   - Reference: `apps/web/src/lib/premium/segment-scorer.ts:53-60` (`isSelfContained()` — 정규식 휴리스틱, `@MX:TODO: Upgrade to Gemini LLM judgment`)
2. **리딩 생성은 온디맨드·per-user다.** `generateReadingPiece()`는 완전 자동(레벨×포맷×토픽 LLM 생성 + 슬롭 검수 + 커버리지 게이트)이지만, **스케줄 사전생성이 없고**, **레벨 다양성 매트릭스가 없다**. 응답만 반환하고 풀로 쌓지 않는다.
   - Reference: `apps/web/src/lib/premium/reading-generation.ts:206-305` (`generateReadingPiece()` — Gemini 2.5 Pro → Azure 폴백 → fixture, `MAX_RETRIES=2`, slop/coverage 게이트)
3. **세션 조립이 레벨을 무시한다.** `GET /api/premium/today`는 캐시 미스 시 `fetchLatestReadingPieceForUser()` + `fetchRandomSegments(3)`로 조립하는데, **`fetchRandomSegments`가 레벨/밴드를 무시하고 랜덤 세그먼트를 뽑는다** — "레벨 다양성"이 구현되어 있지 않다.
   - Reference: `apps/web/src/app/api/premium/today/route.ts:97-112` (`fetchRandomSegments` — `.limit(count)`만, 밴드/난도 필터 없음)
   - Reference: `packages/shared/src/lib/vocab-band.ts:6-55` (밴드 = beginner 500 / basic 1500 / conversation 3000 / professional 6000, `judgeCoverage(ratio)` → too-easy/optimal/too-hard)

또한 **레포 어디에도 콘텐츠 생성용 cron / GitHub Action / 백그라운드 워커가 없다**(plan phase 확인: `apps/web/src`에 cron 키워드 0건).

### 1.3 본 SPEC의 테제: "엔진은 있다, 공급 라인을 깐다"

INPUT-001이 *콘텐츠를 만들 수 있는 부품*을 만들었다면, INPUT-002는 *그 부품이 매일 충분한 다양성으로 풀을 채우고, 사용자가 자기 밴드에 맞게 풀에서 조립받는* **자동 공급 라인**을 정의한다. 핵심 설계 결정은 **per-user 사전생성이 아니라 밴드-레벨 공유 풀 + per-user 조립**이며, 이는 LLM 호출이 사용자 수가 아니라 밴드 수에 비례하도록 비용을 통제하기 위함이다(D3, §6 아키텍처 결정 참조).

---

## 2. 목표 / 비목표 (Goals / Non-Goals)

### 2.1 Goals

| # | 목표 | 근거 갭 |
|---|------|---------|
| G1 | **Agentic 영상 인제스트** — 단일 트리거가 체인: 유튜브 링크/채널 → 트랜스크립트 fetch → per-line 한국어 번역(`translation` 채움) → 세그먼트 분할 → 난도+band_coverage+topic_tags 스코어 → `video_segments` 영속. 기존 부품 재사용. | §1.2-1 |
| G2 | **일일 리딩 배치** — 스케줄 잡이 (밴드 × 포맷 × 토픽) 매트릭스로 `reading_pieces` **풀**을 사전생성. 개별 사용자와 디커플링, 레벨별 일일 다양성 보장. | §1.2-2 |
| G3 | **레벨-aware 세션 조립** — 랜덤 세그먼트 선택을 사용자 vocab 밴드 기반 풀 필터 선택으로 교체. 풀이 얕을 때 폴백 정의. | §1.2-3 |
| G4 | **스케줄링 & 비용** — Vercel Cron 엔트리포인트, 빈도, idempotency, 그리고 LLM 호출이 사용자가 아닌 밴드에 비례하는 러프 비용 모델. | D4 |
| G5 | **레거시 freeze** — 본 SPEC이 레거시 프리미엄 어드민/모델을 건드리지 않음을 명시(freeze 명기). | D2 |

### 2.2 Non-Goals (명시적 제외)

- **레거시 프리미엄 모델 확장/수정 (절대):** `premium_sessions`/`premium_articles`/`premium_expression_cards` 테이블·`apps/web/src/app/admin/premium/page.tsx`(2,106줄)·deprecated 타입을 **읽지도 쓰지도 않는다**. 본 자동화는 v1.3 테이블만 대상으로 한다(D2, REQ-AUTO-005-U2). deprecated 타입의 코드 제거는 **INPUT-001 Stage B(3) 별도 트랙**.
- **per-user 콘텐츠 사전생성:** 사용자별로 리딩을 미리 만들지 않는다(비용 폭발). 풀은 밴드 단위로만 사전생성된다(D3).
- **개인 known-word set 런타임 정밀 커버리지:** 본 SPEC의 커버리지는 INPUT-001과 동일하게 빈도 밴드 기준(`vocab-band.ts`). 개인 set 정밀화는 Out.
- **레벨 다양성 아크(워밍업→피크→쿨다운)·fun 랭킹 고도화:** 세션 조립 v2 영역. 본 SPEC은 "밴드 매칭 + 폴백"까지.
- **외부 사실 검색(real grounding) 통합:** 논픽션 grounding은 INPUT-001의 `STATIC_SOURCE_FACTS` 한도(`reading-generation.ts:13-39`)를 계승. 실시간 검색은 Out.
- **자족성 게이트 LLM 승급:** `isSelfContained()` LLM 승급(`segment-scorer.ts:53`의 `@MX:TODO`)은 본 SPEC에서 **band_coverage/topic_tags 채움과 함께 In**으로 끌어온다(REQ-AUTO-001-W2). 단 이는 인제스트 품질 향상 한정.
- **다국어 글로스:** `translation`은 한국어 단일(번역 라우트가 한↔영 전용).

---

## 3. EARS 요구사항

> EARS 5종: Ubiquitous(항상), Event-driven(WHEN), State-driven(WHILE), Optional(WHERE), Unwanted(IF/THEN ... shall not). 기술 식별자는 영어로 유지한다. 각 모듈 ≤ 약 6개.

### REQ-AUTO-001 — Agentic 영상 인제스트 (트리거 + 번역 + 스코어 완성)

PRD/INPUT-001 §6.3 리스닝 트랙의 *공급*. 단일 트리거(신규 최소 어드민 surface의 버튼 AND/OR 자율 에이전트)가 인제스트 체인을 끝까지 완성한다. 기존 `ingest/route.ts`·`translate/route.ts`·`segment-scorer.ts` 재사용.
관련 데이터: `video_segments`(기존, INPUT-001), `channels`(기존).

- **E1 (Event-driven, WHEN):** WHEN 운영자가 유튜브 링크(또는 화이트리스트 채널)를 트리거로 제출하면, THEN 시스템은 트랜스크립트 fetch → per-line 한국어 번역 → 세그먼트 분할 → 난도·`band_coverage`·`topic_tags` 스코어 → `video_segments` 영속을 **하나의 체인**으로 실행해야 한다.
  - Reference: `apps/web/src/app/api/admin/premium/ingest/route.ts:70-146` (현행 체인 — 번역·band_coverage·topic_tags 미완) · `apps/web/src/lib/premium/youtube-transcript.ts` (`loadTranscriptWithYtDlp` 재사용)
- **U1 (Ubiquitous):** 시스템은 항상 인제스트된 각 세그먼트의 `transcript` 각 라인에 한국어 `translation`을 채워 영속해야 하며, 번역은 기존 배치 번역 로직을 재사용해야 한다.
  - Reference: `apps/web/src/app/api/admin/translate/route.ts:71-167` (`buildTranslationPrompt`·`translateBatchWithFallback` 배치 번역 재사용) · `packages/shared/src/types/index.ts:6` (`TranscriptLine.translation` 필드 — 현재 인제스트가 미채움)
- **U2 (Ubiquitous):** 시스템은 항상 각 세그먼트에 `band_coverage`(밴드별 어휘 커버리지 jsonb)와 `topic_tags`(주제 태그)를 산출하여 영속해야 한다. `band_coverage`는 `vocab-band.ts` 밴드 기준으로, `topic_tags`는 트랜스크립트 기반 분류로 채운다(현재 빈 placeholder).
  - Reference: `apps/web/src/app/api/admin/premium/ingest/route.ts:119-124` (`band_coverage: {}`·`topic_tags: []` 빈 삽입) · `packages/shared/src/lib/vocab-band.ts:6-17` (밴드 단어수 기준)
- **W1 (State-driven, WHILE):** WHILE 인제스트 체인이 진행 중인 동안, THEN 시스템은 각 단계(트랜스크립트/번역/스코어/영속) 실패를 격리하여 한 세그먼트 실패가 전체 인제스트를 중단시키지 않아야 한다(부분 성공 허용).
  - Reference: `apps/web/src/app/api/admin/premium/ingest/route.ts:100-134` (현행 세그먼트별 try-continue 패턴 계승)
- **W2 (State-driven, WHILE):** WHILE 자족성 판정이 수행되는 동안, THEN 시스템은 정규식 휴리스틱(현행) 또는 Gemini LLM 판정으로 `self_contained`를 산출해야 한다(`@MX:TODO` 승급 In).
  - Reference: `apps/web/src/lib/premium/segment-scorer.ts:53-60` (`isSelfContained()` 정규식 v1 + LLM 승급 TODO)
- **U3 (Unwanted, IF/THEN):** IF 트리거 요청자가 어드민이 아니라면, THEN 시스템은 인제스트를 실행하지 않고 인증 오류를 반환해야 한다(자율 에이전트 트리거는 서버 전용 키로 게이트).
  - Reference: `apps/web/src/app/api/admin/premium/ingest/route.ts:71-72` (`requireAdmin()` 게이트 계승)

### REQ-AUTO-002 — 일일 리딩 배치 (밴드 × 포맷 × 토픽 풀 사전생성)

§1.2-2: 온디맨드·per-user `generateReadingPiece()`를 **스케줄 사전생성 풀**로 전환. 풀은 개별 사용자와 디커플링되어 (밴드 × 포맷 × 토픽) 매트릭스로 일일 다양성을 채운다(D3).
관련 데이터: `reading_pieces`(기존 — `user_id` nullable 활용 + `band` 컬럼 신규, §5).

- **E1 (Event-driven, WHEN):** WHEN 일일 리딩 배치가 트리거되면, THEN 시스템은 (밴드 × 포맷 × 토픽) 매트릭스를 순회하며 각 셀에 대해 `generateReadingPiece()`를 호출하고, 생성 결과를 **풀 row**(`user_id = NULL`, `band` 지정)로 `reading_pieces`에 영속해야 한다.
  - Reference: `apps/web/src/lib/premium/reading-generation.ts:206-305` (`generateReadingPiece()` 재사용) · `supabase/migrations/20260615000300_reading_pieces.sql:1-12` (`user_id` nullable, `band` 컬럼 부재 → 신규 필요)
- **U1 (Ubiquitous):** 시스템은 항상 풀 매트릭스를 **밴드 4종(beginner/basic/conversation/professional) × 포맷 6종(noir/dialogue/nonfiction/editorial/economic/business) × 토픽 N**으로 정의하고, 밴드별 일일 생성 볼륨을 config로 운영 튜닝 가능하게 유지해야 한다.
  - Reference: `packages/shared/src/lib/vocab-band.ts:6-11` (밴드 4종) · `apps/web/src/lib/premium/reading-generation.ts:41` (`FICTION_FORMATS` + 포맷 분기 `:98-109`)
- **E2 (Event-driven, WHEN):** WHEN 배치가 풀 row를 생성할 때, THEN 시스템은 같은 (밴드 × 포맷 × 토픽) 셀에서 최근 생성물과의 **중복/반복을 회피**해야 한다(토픽 로테이션 또는 최근 N개 dedup).
- **W1 (State-driven, WHILE):** WHILE 생성된 풀 row가 슬롭 검수(픽션) 또는 grounding(논픽션) 또는 커버리지 게이트를 통과하지 못한 동안, THEN 시스템은 해당 row를 `validation_status`로 격리하고 발행 풀에 포함하지 않아야 한다.
  - Reference: `apps/web/src/lib/premium/reading-generation.ts:240-260` (slop/coverage 게이트) · `supabase/migrations/20260615000300_reading_pieces.sql:8` (`validation_status` CHECK pending/approved/rejected)
- **U2 (Ubiquitous):** 시스템은 항상 풀 row 라이프사이클(생성일·만료/staleness·`validation_status`)을 관리하여 오래된(stale) row가 무한히 조립 대상이 되지 않게 해야 한다.
- **U3 (Unwanted, IF/THEN):** IF 배치가 풀 row를 생성하면서 `user_id`를 특정 사용자로 채우려 한다면, THEN 시스템은 이를 허용하지 않아야 한다(풀 row는 항상 `user_id = NULL` — per-user 사전생성 금지, D3).

### REQ-AUTO-003 — 레벨-aware 세션 조립 (랜덤 → 밴드 필터 + 폴백)

§1.2-3: `fetchRandomSegments`의 레벨 무시를 사용자 vocab 밴드 기반 풀 필터로 교체. 풀이 얕을 때 폴백 정의(D3).
관련 데이터: `ci_sessions`(기존 — per-user-per-day 캐시), `reading_pieces`·`video_segments` 풀.

- **E1 (Event-driven, WHEN):** WHEN 사용자가 오늘 세션을 요청하고 캐시(`ci_sessions`)가 미스이면, THEN 시스템은 사용자 vocab 밴드에 맞는 `reading_pieces` 풀 row 1편과 `video_segments` 풀에서 밴드-필터된 세그먼트 N개를 조립하여 `ci_sessions`에 영속해야 한다.
  - Reference: `apps/web/src/app/api/premium/today/route.ts:225-254` (캐시 체크 + 조립 + `insertCiSession`) · `:114-128` (`fetchCachedCiSession` UNIQUE(user,date) 캐시)
- **U1 (Ubiquitous):** 시스템은 항상 세그먼트 선택을 사용자 밴드 기준 `band_coverage`/난도로 필터하여 수행해야 하며, 레벨을 무시한 순수 랜덤 선택을 하지 않아야 한다(현행 교체 대상).
  - Reference: `apps/web/src/app/api/premium/today/route.ts:97-112` (`fetchRandomSegments` — 밴드 필터 없음, 교체 대상) · `packages/shared/src/lib/vocab-band.ts:43-55` (`judgeCoverage`/`coverageDifficultyAdjustment`)
- **U2 (Ubiquitous):** 시스템은 항상 리딩 풀 조회를 풀 row(`user_id = NULL` + 밴드 일치) 기준으로 수행해야 하며, per-user 리딩(`user_id = 사용자`)이 존재해도 풀을 1차 소스로 우선해야 한다.
  - Reference: `apps/web/src/app/api/premium/today/route.ts:81-95` (`fetchLatestReadingPieceForUser` — `.eq("user_id", userId)` per-user 조회, 풀 조회로 교체/보강 필요)
- **W1 (State-driven, WHILE):** WHILE 사용자 밴드의 풀이 얕은(요청 세그먼트 수 또는 리딩 1편을 못 채우는) 상태인 동안, THEN 시스템은 인접 밴드로 폴백하거나(±1 밴드) 풀이 빌 때까지 가용분만 조립하여 빈 세션을 반환하지 않아야 한다.
- **U3 (Unwanted, IF/THEN):** IF 사용자 밴드와 인접 밴드 모두 풀이 비어 콘텐츠를 0개 조립하게 된다면, THEN 시스템은 빈 세션 대신 명시적 "준비 중" 상태를 반환해야 한다(크래시·빈 배열 무응답 금지).
- **U4 (Ubiquitous):** 시스템은 항상 조립을 `ci_sessions`의 per-user-per-day idempotency(`UNIQUE(user_id, session_date)`)로 캐시하여 같은 날 재요청 시 LLM·풀 재조립을 하지 않아야 한다.
  - Reference: `supabase/migrations/20260615000700_ci_sessions.sql:9` (`UNIQUE(user_id, session_date)`)

### REQ-AUTO-004 — 스케줄링 & 비용 (Vercel Cron + idempotency + 비용 모델)

§G4/D4: Vercel Cron 엔트리포인트로 배치를 스케줄. 호출은 사용자가 아닌 밴드에 비례. idempotency로 중복 실행 안전.
관련: `apps/web/vercel.json`(기존 — `crons` 키 부재), Supabase scheduled functions(대안).

- **E1 (Event-driven, WHEN):** WHEN 스케줄된 시각이 도래하면, THEN 시스템은 Vercel Cron이 호출하는 서버 라우트로 일일 리딩 배치(REQ-AUTO-002)를 실행해야 한다.
  - Reference: `apps/web/vercel.json:25-29` (`functions` 설정 존재, `crons` 키 신규 추가 대상) · `apps/web/vercel.json:7` (`regions: ["icn1"]`)
- **U1 (Ubiquitous):** 시스템은 항상 Cron 엔트리포인트를 서버 전용으로 인증해야 하며(`CRON_SECRET` 또는 Vercel Cron 헤더 검증), 인증되지 않은 외부 호출로 배치가 실행되지 않아야 한다.
- **W1 (State-driven, WHILE):** WHILE 배치 실행 윈도우 동안, THEN 시스템은 idempotency 키(실행일 + 밴드/포맷/토픽 셀)로 같은 날 중복 실행이 풀을 이중 생성하지 않게 보장해야 한다.
- **U2 (Ubiquitous):** 시스템은 항상 LLM 호출량이 **사용자 수가 아니라 밴드 수에 비례**하도록 배치를 설계해야 한다: 일일 호출 ≈ (밴드 4 × 포맷 N × 토픽 M × 재시도 ≤2). per-user 호출은 질문 에이전트(INPUT-001 REQ-INPUT-004, 월 캡)에만 허용된다.
  - Reference: `apps/web/src/lib/premium/reading-generation.ts:204` (`MAX_RETRIES = 2` 비용 상한 인자)
- **U3 (Unwanted, IF/THEN):** IF Vercel 플랜 제약(Hobby의 cron 빈도/개수 한도)으로 필요한 스케줄을 충족할 수 없다면, THEN 시스템은 단일 Cron이 내부 루프로 여러 셀을 처리하거나 Supabase scheduled function 대안으로 강등해야 한다(빈도 한도 위반 금지).
- **O1 (Optional, WHERE):** WHERE 인제스트(REQ-AUTO-001)도 스케줄 자동화가 필요한 경우, 시스템은 화이트리스트 채널 신규 영상 폴링을 별도 Cron으로 추가할 수 있다(영상 트랙 자율 에이전트화).

### REQ-AUTO-005 — 레거시 Freeze 제약

§G5/D2: 본 자동화가 레거시 프리미엄 어드민/모델을 건드리지 않음을 강제. deprecated 타입 정리는 별도 트랙.

- **U1 (Ubiquitous):** 시스템은 항상 자동화 파이프라인을 v1.3 테이블(`reading_pieces`·`video_segments`·`channels`·`ci_sessions`)만 대상으로 동작시켜야 한다.
- **U2 (Unwanted, IF/THEN):** IF 자동화 코드 경로(인제스트·배치·조립·Cron)가 레거시 테이블(`premium_sessions`·`premium_articles`·`premium_expression_cards`)이나 레거시 어드민 UI(`apps/web/src/app/admin/premium/page.tsx`)나 deprecated 타입(`PremiumArticle`·`PremiumExpressionCard`·`PremiumRoleplay`·`PREMIUM_SESSION_STEPS`)을 읽거나 쓰려 한다면, THEN 시스템은 이를 허용하지 않아야 한다(자동화는 레거시에 도달 불가).
  - Reference: `apps/web/src/app/admin/premium/page.tsx:1` (2,106줄 레거시 어드민 — freeze, 자동화 비대상)
- **U3 (Ubiquitous):** 시스템은 항상 deprecated 타입의 코드 제거를 본 SPEC이 아닌 **INPUT-001 Stage B(3) 별도 트랙**에 위임해야 한다(본 SPEC은 freeze만, 제거 안 함).
  - Reference: `.moai/specs/SPEC-INPUT-001/plan.md:42` (Stage B(3) shared premium 타입 deprecate→제거 트랙)

---

## 4. Traceability

| 요구 모듈 | 갭 근거 | 신규/확장 데이터 | 핵심 재사용(KEEP) |
|---|---|---|---|
| REQ-AUTO-001 agentic 인제스트 | §1.2-1 | `video_segments`(확장: translation/band_coverage/topic_tags 채움) | ingest route, translate route, youtube-transcript, segment-scorer |
| REQ-AUTO-002 일일 리딩 배치 | §1.2-2 | `reading_pieces`(확장: `band` 컬럼 + `user_id` nullable 풀 row + 인덱스) | `generateReadingPiece()`, voice-rules, coverage gate |
| REQ-AUTO-003 레벨-aware 조립 | §1.2-3 | `ci_sessions`(기존), 풀 조회 신규 | today route 조립 골격, vocab-band, ci_sessions 캐시 |
| REQ-AUTO-004 스케줄링·비용 | D4 | `vercel.json` crons(신규) | vercel.json functions 설정 |
| REQ-AUTO-005 레거시 freeze | D2 | (없음 — 제약) | — |

> **INVIOLABLE KEEP:** `ingest/route.ts` 체인 골격, `translate/route.ts` 배치 번역, `youtube-transcript.ts`, `segment-scorer.ts`, `generateReadingPiece()`, `reading-generation.ts` 게이트, `today/route.ts` 조립·캐시 골격, `vocab-band.ts`, `ci_sessions` UNIQUE 캐시는 절대 제거하지 않고 확장만 한다.
> **INVIOLABLE FREEZE:** 레거시 프리미엄 테이블·어드민 UI·deprecated 타입은 자동화가 절대 읽거나 쓰지 않는다(REQ-AUTO-005-U2).

상세 구현 계획은 `plan.md`, 인수 기준은 `acceptance.md`를 참조한다.
