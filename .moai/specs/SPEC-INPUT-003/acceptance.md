# SPEC-INPUT-003 인수 기준 (acceptance.md)

> 각 요구 모듈(REQ-VOCAB-F/A/P/R/I)별 Given/When/Then 시나리오 2개 이상 + 엣지 케이스. 방법론 = **TDD**(tests-first). 근거: `spec.md` EARS 요구, `plan.md` 페이징·스코어링 수학, SPEC-INPUT-001/002 코드(ground truth).

---

## REQ-VOCAB-F — 빈도 리스트 기반 (정전 lemma 리스트)

### AC-F-1 (정전 리스트 단일 소스)
- **Given** 빈도-랭크 lemma 정전 리스트가 로드되어 있다
- **When** 어휘 테스트 샘플링·`known_words` 밴드 태깅·`computeBandCoverage`가 실행된다
- **Then** 세 경로 모두 동일한 정전 리스트를 단일 소스로 소비하며, 손-시드 `BAND_SETS`(`band-coverage.ts:20-953`)를 더 이상 사용하지 않는다 (REQ-VOCAB-F-U1/U3)

### AC-F-2 (랭크 기반 밴드 분할)
- **Given** 정전 리스트의 각 lemma에 빈도 랭크가 있다
- **When** 시스템이 lemma의 밴드를 결정한다
- **Then** beginner=1–500 / basic=501–1500 / conversation=1501–3000 / professional=3001–6000 / advanced=6001+로 분할되고, 밴드는 오직 랭크로 결정된다 (REQ-VOCAB-F-U2)

### 엣지 케이스
- **EC-F-A (누적 의미 보존):** `computeBandCoverage`가 professional ⊇ conversation ⊇ basic ⊇ beginner 단조성을 유지하고 시그니처가 변하지 않는다 (REQ-VOCAB-F-U3, `band-coverage.ts:938-1003`).
- **EC-F-B (로드 실패 fatal):** 정전 리스트 로드 실패 시 어휘 테스트가 차단되고, 불완전 손-시드 셋으로 조용히 폴백하지 않는다 (REQ-VOCAB-F-W1).
- **EC-F-C (라이선스 가드):** 비투과 라이선스 리스트는 명시적 라이선싱 결정 기록 없이 배포되지 않는다 (REQ-VOCAB-F-U4).
- **EC-F-D (경계 랭크):** 랭크 500/501, 1500/1501, 3000/3001, 6000/6001이 정확히 인접 밴드로 분류된다.

---

## REQ-VOCAB-A — Yes/No 측정 스코어링 (위양성 보정)

### AC-A-1 (측정 → 밴드 + seed 동시 산출)
- **Given** 사용자가 밴드별 실단어 ~40개 + 의사단어 M개에 know/don't-know를 제출한다
- **When** 스코어러가 실행된다
- **Then** 의사단어 "yes"로 위양성률이 산출되어 원 추정이 보정되고, (a) 추정 어휘 크기 + `estimated_band`(4밴드)·`estimated_level`(CEFR)와 (b) seed known-word 셋이 동시에 산출된다 (REQ-VOCAB-A-E1/U1/U2)

### AC-A-2 (의사단어 위양성 보정 수학)
- **Given** 한 밴드에서 실단어 hitRate=0.8, 의사단어 falsePositiveRate=0.3이다
- **When** 보정 known 비율이 계산된다
- **Then** `correctedFrac = max(0, (0.8 − 0.3) / (1 − 0.3)) ≈ 0.714`로 산출되고, 추정 크기는 Σ밴드(보정비율 × 밴드폭)이다(밴드폭 500/1000/1500/3000) (REQ-VOCAB-A-U1)

### AC-A-3 (professional 클램프 + seed 실단어만)
- **Given** 추정 어휘 크기가 advanced 영역(6001+)을 가리킨다
- **When** 밴드 매핑과 seed 산출이 실행된다
- **Then** `estimated_band`는 `professional`로 클램프되어 `advanced`를 산출하지 않고(REQ-VOCAB-A-U2), seed `known_words`는 "안다"고 표기한 **실단어만** 포함하며 `frequency_band`는 5밴드(`advanced` 허용)로 태깅된다 (REQ-VOCAB-A-U3)

### 엣지 케이스
- **EC-A-A (위양성 안전 클램프):** `falsePositiveRate ≥ 1` 또는 의사단어 0개(분모 0)일 때 0나눗셈·음수 비율 없이 안전 클램프되고 보수적 밴드로 강등된다 (REQ-VOCAB-A-W1).
- **EC-A-B (과대표기 하향):** 의사단어 위양성률이 0.5를 초과하면 원 hitRate를 신뢰하지 않고 밴드 추정이 하향되어, 과대표기 사용자가 부풀린 밴드가 아니라 보수적 밴드를 받는다 (REQ-VOCAB-A-U4).
- **EC-A-C (의사단어 절대 제외):** 어떤 의사단어도 seed `known_words`에 포함되지 않는다 (REQ-VOCAB-A-U3).
- **EC-A-D (전부 don't-know):** 모든 실단어를 모른다고 표기하면 추정 크기≈0 → `estimated_band=beginner`, seed `known_words`=빈 셋으로 산출되고 크래시하지 않는다.

---

## REQ-VOCAB-P — Persist (현재 부재 라이터)

### AC-P-1 (프로필 upsert + update_history)
- **Given** 측정 스코어링이 완료되었다(estimated_band/level + 스냅샷)
- **When** 라이터가 영속한다
- **Then** `user_vocab_profiles` row 1개가 `UNIQUE(user_id)` 키로 upsert되고, `update_history`에 스코어 스냅샷이 append된다 (REQ-VOCAB-P-E1, `20260615000100:6,9`)

### AC-P-2 (known_words 벌크 insert + idempotent 재시드)
- **Given** seed known-word 셋(source='seed', lemma별 frequency_band)이 산출되었다
- **When** 라이터가 `known_words`에 벌크 insert한다
- **Then** 각 row가 `source='seed'`로 영속되고, `UNIQUE(user_id, lemma)` 충돌 시 on-conflict로 idempotent 처리되어 중복키 실패가 발생하지 않는다 (REQ-VOCAB-P-E2, `20260615000200:9`)

### AC-P-3 (RLS self_only 준수)
- **Given** 인증 사용자가 본인 측정 결과를 영속한다
- **When** 라이터가 write를 실행한다
- **Then** user-token client로 RLS(`auth.uid()=user_id`)가 자동 충족되거나, admin client 사용 시 모든 write가 측정 대상 `user_id`로 명시 스코프된다. 타 사용자 row write는 거부된다 (REQ-VOCAB-P-U1, `self_only`)

### 엣지 케이스
- **EC-P-A (부분 실패 복구):** 프로필만 기록되고 known_words insert가 실패하면, 불일치(밴드-without-seed)가 탐지되고 재시도 가능하며 조용히 남지 않는다 (REQ-VOCAB-P-W1).
- **EC-P-B (의사단어/미표기 차단):** 의사단어 또는 사용자가 "안다"고 표기하지 않은 lemma를 insert하려는 시도가 `known_words`에 영속되지 않는다 (REQ-VOCAB-P-U2).
- **EC-P-C (재측정 idempotency):** 같은 사용자가 테스트를 다시 치르면 프로필이 덮어쓰기(upsert)되고 known_words가 on-conflict로 갱신되며 중복 row가 쌓이지 않는다.

---

## REQ-VOCAB-R — Refine (런타임 적응 루프 + 히스테리시스)

### AC-R-1 (커버리지 신호 → 난도 방향)
- **Given** 사용자 세션 콘텐츠가 있고 `known_words`로 구성한 knownLemmas 셋이 있다
- **When** `verifyCoverage(content, knownLemmas)`가 unknownRatio를 산출한다
- **Then** `coverageDifficultyAdjustment(unknownRatio)`가 −1/0/+1을 산출하고 해당 사용자의 방향 투표로 기록된다 (REQ-VOCAB-R-E1, `reading-coverage.ts:28-37`·`vocab-band.ts:43-55`)

### AC-R-2 (히스테리시스 밴드 조정)
- **Given** 사용자의 직전 방향 투표가 +1, +1로 2회 누적되었다(K=3)
- **When** 세 번째 세션도 +1 방향 신호를 준다
- **Then** K=3 연속 동방향이 충족되어 `estimated_band`가 한 단계 상향(예: conversation→professional)되고, 4밴드 범위로 클램프되며, `update_history`에 스냅샷이 append되고 투표 카운터가 리셋된다 (REQ-VOCAB-R-W1/E2)

### AC-R-3 (tap-to-gloss → known_words)
- **Given** 사용자가 콘텐츠에서 단어를 탭해 글로스를 본다
- **When** `onWordTap(lemma)`가 호출된다
- **Then** 그 lemma가 `known_words`에 `source='tap'` + `last_seen=now()`로 insert/upsert된다 (REQ-VOCAB-R-E3, `20260615000200:6-7`)

### 엣지 케이스
- **EC-R-A (히스테리시스 — 미달 시 무플립):** 방향 신호가 +1, −1, +1처럼 흔들리거나 K 미만이면 밴드가 뒤집히지 않는다(매 세션 플립 방지) (REQ-VOCAB-R-W1).
- **EC-R-B (밴드 클램프):** `professional`에서 +1 신호가 K연속 와도 professional을 초과하지 않고, `beginner`에서 −1 신호가 와도 beginner 미만으로 내려가지 않는다 (REQ-VOCAB-R-W1).
- **EC-R-C (빈 known_words 콜드 스타트):** `known_words`가 비었을 때 빈 set으로 인한 "전부 unknown" 오인 0% 커버리지를 산출하지 않고, `computeBandCoverage` 밴드-셋 폴백으로 우아하게 강등한다 (REQ-VOCAB-R-U1, `band-coverage.ts:977-1003`).
- **EC-R-D (inferred 선택):** 활성화 시 완독 콘텐츠 토큰이 `source='inferred'`로 insert되고, seed/tap보다 낮은 신뢰로 취급된다 (REQ-VOCAB-R-O1).

---

## REQ-VOCAB-I — 통합 & 온보딩 UX 계약

### AC-I-1 (resolveUserBand 실측 — 무변경 적용)
- **Given** 라이터가 사용자의 `user_vocab_profiles.estimated_band`를 채웠다
- **When** 사용자가 오늘 세션을 요청해 `resolveUserBand()`가 호출된다
- **Then** Priority 1(`estimated_band`)이 실효되어 실측 밴드가 반환되고, `today/route.ts`(`:108-146`) 코드는 변경되지 않는다(라이터만으로 적용) (REQ-VOCAB-I-U1)

### AC-I-2 (knownLemmas 게이트 실효 — 시그니처 KEEP)
- **Given** per-user 리딩이 생성/검증되고 `known_words`에서 구성한 populated knownLemmas 셋이 있다
- **When** `generateReadingPiece({ knownLemmas })`가 호출된다
- **Then** 기존 `verifyCoverage` 게이트(`reading-generation.ts:252-275`)가 populated set으로 실효되며 함수 시그니처(`knownLemmas?: Set<string>`, `:65`)는 변경되지 않는다 (REQ-VOCAB-I-E1)

### AC-I-3 (중도이탈 폴백 — 부분 미영속)
- **Given** 사용자가 온보딩 어휘 테스트를 완료 전 중도이탈한다
- **When** 세션 밴드가 해석된다
- **Then** 부분/쓰레기 `user_vocab_profiles` row가 영속되지 않고, 기존 `level_band`(있으면) 또는 `conversation`(기본값)으로 폴백된다 (REQ-VOCAB-I-W1, `today/route.ts:130-145`)

### 엣지 케이스
- **EC-I-A (밴드-키 풀 불변):** `known_words`가 채워져도 INPUT-002 콘텐츠 풀은 밴드-키 유지이고, per-user 사전생성으로 전환되지 않는다 (REQ-VOCAB-I-U1, D4).
- **EC-I-B (모바일 계약 — 맹목 편집 금지):** 본 SPEC 구현은 `apps/mobile/**` 온보딩 UI를 맹목 편집하지 않고, 모바일 UI 변경은 동시 세션과 별도 트랙으로 조율된다 (REQ-VOCAB-I-U3).
- **EC-I-C (제출 페이로드 서버 검증):** 클라이언트가 보낸 토큰의 isReal/밴드를 서버가 빈도 리스트로 재검증하고 클라이언트 주장을 신뢰하지 않는다 (계약 C5.4).

---

## 품질 게이트 기준 (TRUST 5 + TDD)

- **Tested:** 모든 요구 모듈은 tests-first(TDD RED→GREEN→REFACTOR). 커밋당 최소 커버리지 80%(`quality.yaml min_coverage_per_commit`), 목표 85%. 구현보다 먼저 작성된 테스트가 아니면 거부.
- **순수함수 우선 검증:** 스코어러(REQ-VOCAB-A)·히스테리시스(REQ-VOCAB-R-W1)·밴드 매핑은 DB·UI 없이 순수함수 단위 테스트로 수학 검증(위양성 보정·클램프·과대표기 하향).
- **데이터 모델 불변식:** `estimated_band` 4밴드(professional 클램프, `advanced` 미산출), `known_words.frequency_band` 5밴드(`advanced` 허용)를 테스트로 강제(CHECK 제약 정합).
- **의사단어 격리:** 어떤 의사단어도 `known_words`/콘텐츠에 영속되지 않음을 테스트로 보증(REQ-VOCAB-A-U3 / P-U2 / R10).
- **라이터 idempotency:** 프로필 upsert(`UNIQUE(user_id)`)·known_words on-conflict(`UNIQUE(user_id,lemma)`)가 재측정·재시드에 중복 row를 만들지 않음을 테스트로 보증(REQ-VOCAB-P-E1/E2).
- **RLS 게이트:** 두 테이블 `self_only` 준수 — 타 사용자 row write 거부, user-token vs admin 스코프 테스트(REQ-VOCAB-P-U1).
- **히스테리시스 보증:** K 미만 무플립·K 도달 시 1단계 플립·4밴드 클램프·카운터 리셋을 테스트로 보증(REQ-VOCAB-R-W1).
- **콜드 스타트 폴백:** 빈 `known_words` 시 빈 set 함정 회피(`computeBandCoverage` 폴백)를 테스트로 보증(REQ-VOCAB-R-U1).
- **무변경 통합:** 라이터 채운 후 `resolveUserBand` Priority 1 실효·`generateReadingPiece` 시그니처 불변을 회귀 테스트로 보증(REQ-VOCAB-I-U1/E1).
- **LSP 게이트(run):** errors 0, type errors 0, lint errors 0 (`quality.yaml lsp_quality_gates.run`).
- **Secured:** 측정 제출 API 인증(`requireApiUser` 류), RLS self_only, 빈도 리스트 라이선스 결정 기록(F-U4).
- **SCOPE 분리:** 측정·스코어·라이터·API·루프는 `apps/web`+`packages/shared`만 편집. 모바일 온보딩 UI는 미편집(계약, 조율 트랙).
- **freeze 가드(계승):** 측정·루프 코드가 레거시 프리미엄 테이블/어드민/타입을 import·query하지 않음(INPUT-002 REQ-AUTO-005 계승).
- **Definition of Done:** REQ-VOCAB-F/A/P/R/I의 모든 AC + 엣지 케이스 통과, 라이터가 `user_vocab_profiles`·`known_words`를 실제로 채움(현행 무라이터 해소), `resolveUserBand` Priority 1 실효(today route 무변경), 히스테리시스 적응 동작, 의사단어 격리·데이터모델 불변식 유지, INPUT-001/002 KEEP 부품(reading-coverage/vocab-band/band-coverage/resolveUserBand/generateReadingPiece) 불가침, 모바일 UI 미편집(계약만).
