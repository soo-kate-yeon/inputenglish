---
id: SPEC-INPUT-003
version: 0.2.0
status: Implemented
created: 2026-06-16
updated: 2026-06-16
author: soo-kate-yeon
priority: High
lifecycle_level: spec-anchored
platform: web-backend, shared, ios-consumer-contract
related_specs: SPEC-INPUT-001, SPEC-INPUT-002
---

# SPEC-INPUT-003: 어휘 측정 + 적응형 밴드 루프 (Vocab Assessment & Adaptive Band Loop)

> 본 SPEC은 **SPEC-INPUT-001(v1.3 CI 엔진)** 과 **SPEC-INPUT-002(콘텐츠 자동화 레이어)** 위에 얹는 **사용자 어휘 측정 + 영속 라이터 + 적응형 밴드 루프**다. INPUT-002가 깐 밴드 매칭 공급 라인의 핵심 입력인 `resolveUserBand()`가 읽는 `user_vocab_profiles.estimated_band`에는 **라이터가 없어**, 현재 밴드 해석은 항상 구(舊) 온보딩 자기보고(`users.level_band`, 4지선다) 또는 기본값 `conversation`으로 폴백한다. 따라서 Comprehensible Input의 핵심 메커니즘(i+1, 미지어 2~5%)이 **실측 없이** 돌고 있다. 본 SPEC은 그 측정·라이터·루프를 만든다.
> 본 문서의 모든 코드 사실은 plan phase에서 코드베이스 전수 확인됨(이미 검증됨, ground truth로 취급). Reference 인용은 `Reference: {file_path}:{line_range}` 형식을 사용한다.

---

## HISTORY

- **v0.2.0 — 2026-06-16** — TDD 구현 완료(Phase 0~4, web/shared 전용). REQ-VOCAB-F 빈도 리스트(NGSL+NAWL CC BY-SA 4.0, 3807 lemma, band-coverage 손-시드 교체), REQ-VOCAB-A Yes/No 스코어러(의사단어 위양성 보정, professional 클램프, seed known_words 산출), REQ-VOCAB-P Persist 라이터(user_vocab_profiles upsert + known_words seed, RLS user_id 스코프, 서버 재검증, idempotent), REQ-VOCAB-R Refine 루프(히스테리시스 K연속 밴드조정, tap 라이터, 콜드스타트 폴백), REQ-VOCAB-I 통합(reading 라우트 knownLemmas 결선으로 per-user i+1 게이트 실효, today/route.ts 무변경, freeze 가드). 신규 테스트 200+ 통과, tsc 0, 신규 회귀 0. Phase 5(모바일 온보딩 UI)는 계약만 — 동시 모바일 세션과 조율(별도 트랙). status: Implemented.
- **v0.1.0 — 2026-06-16** — 초안 작성. 어휘 측정(Yes/No 어휘크기 테스트 + 의사단어 위양성 보정) + 영속 라이터(`user_vocab_profiles`·`known_words` 현행 무(無)라이터 충전) + 적응형 Seed→Persist→Refine 루프(런타임 `verifyCoverage`→`coverageDifficultyAdjustment`→히스테리시스 밴드 조정 + tap-to-gloss `known_words` 갱신)를 단일 SPEC으로 정의. 빈도-랭크 lemma 리스트를 단일 소스로 채택(라이선싱 리스크 명기). 측정·스코어·라이터·API·루프는 **web/shared 전용**(고립 구현 안전), 모바일 온보딩 UI는 **문서화된 계약**(별도 트랙 조율). 방법론 = TDD. author: soo-kate-yeon.

---

## 결정된 기본값 (Resolved Decisions)

본 SPEC 착수 전 사용자가 확정한 결정. 이하 EARS 요구사항은 이 값을 기준으로 기술된다.

| # | 결정 항목 | 확정값 | 관련 REQ |
|---|-----------|--------|---------|
| D1 | 온보딩 측정 | **Yes/No 어휘크기 테스트.** 빈도 밴드별로 샘플된 실단어 ~40개 + 의사단어(pseudoword, 가짜 단어) 몇 개를 제시 → 사용자가 know/don't-know 표기 → 의사단어 "yes"로 위양성 보정해 어휘 크기 추정 → 밴드 매핑. 결과는 밴드 **AND** 초기 `known_words`(source='seed')를 동시에 시드한다. | REQ-VOCAB-A, REQ-VOCAB-P |
| D2 | 아키텍처 | **3단계 Seed → Persist → Refine.** Seed(온보딩 테스트) → Persist(현재 부재 라이터: `user_vocab_profiles` + `known_words` 기록) → Refine(세션마다 `verifyCoverage`→`judgeCoverage`→`coverageDifficultyAdjustment`로 밴드 너지, tap-to-gloss로 `known_words` 갱신, 히스테리시스로 밴드가 매 세션 뒤집히지 않게). | REQ-VOCAB-A, REQ-VOCAB-P, REQ-VOCAB-R |
| D3 | 빈도 리스트 | **빈도-랭크 lemma 리스트(단일 소스).** 실제 BNC/COCA류 상위 ~6000 lemma 빈도 리스트가 테스트 샘플링·`computeBandCoverage`·`known_words` 밴드 태깅을 구동. 현행 `band-coverage.ts`의 손-시드 단어셋을 이 정전(canonical) 리스트로 교체. 라이선싱/출처를 리스크/결정으로 FLAG(투과적 라이선스 리스트 선호). | REQ-VOCAB-F |
| D4 | 밴드-키 풀 불변 | **INPUT-002 공유 콘텐츠 풀은 밴드-키 유지(비용 통제).** `known_words`는 밴드 내 **랭킹**(`fetchSegmentsForBand`)과 per-user 리딩 커버리지 게이트를 통해 per-user 정밀도를 더할 뿐, 콘텐츠를 per-user 사전생성으로 만들지 않는다. | REQ-VOCAB-R, REQ-VOCAB-I |

---

## 1. 배경 (Background)

### 1.1 현 상태: 밴드 매칭은 깔렸으나 "측정"이 비어 있다

INPUT-002가 레벨-aware 세션 조립을 완성하면서, 세션 조립의 1차 입력은 `resolveUserBand()`가 산출하는 `VocabBand`(beginner/basic/conversation/professional)다. 이 함수는 **3단 우선순위**로 밴드를 정한다(plan phase 확인).

1. **Priority 1 — `user_vocab_profiles.estimated_band`** (실측 의도)
2. **Priority 2 — `users.level_band`** (구 온보딩 4지선다 자기보고, 1:1 VocabBand 매핑)
3. **Priority 3 — 기본값 `conversation`**

- Reference: `apps/web/src/app/api/premium/today/route.ts:108-146` (`resolveUserBand` — `@MX:ANCHOR`, 우선순위 1→2→3)
- Reference: `apps/web/src/app/api/premium/today/route.ts:40-45` (`LEVEL_BAND_TO_VOCAB_BAND` 1:1 맵)

### 1.2 문제: Priority 1의 라이터가 존재하지 않는다

`user_vocab_profiles`와 `known_words` 테이블은 INPUT-001이 **이 루프를 위해 목적성으로 만들어 두었으나**, plan phase 전수 검색 결과 **두 테이블 어디에도 라이터(insert/upsert)가 없다**. 따라서:

- `resolveUserBand()`의 Priority 1은 **항상 비어 있어** 매 호출이 Priority 2(자기보고) 또는 Priority 3(기본값)으로 폴백한다.
- 즉, comprehension density의 핵심(i+1, 미지어 2~5%)이 **실제 어휘 측정 없이** 자기보고/기본값에 의존한다.
- `known_words.source` enum(`seed`/`tap`/`inferred`)은 정확히 본 루프를 위해 만들어졌으나 **라이터가 없다**.

근거 데이터(plan phase 확인):

- `user_vocab_profiles`(`supabase/migrations/20260615000100_user_vocab_profiles.sql:1-12`): `{ user_id UNIQUE, estimated_band CHECK IN (beginner/basic/conversation/professional) — 4밴드, estimated_level DEFAULT 'A2', update_history jsonb DEFAULT '[]' }`, RLS `self_only`. **라이터 무(無).**
- `known_words`(`supabase/migrations/20260615000200_known_words.sql:1-12`): `{ user_id, lemma, frequency_band CHECK IN (beginner/basic/conversation/professional/advanced) — 5밴드, source CHECK IN ('seed','tap','inferred'), last_seen, UNIQUE(user_id, lemma) }`, RLS `self_only`. **라이터 무(無).**
- Reference: `apps/web/src/app/api/premium/today/route.ts:117-128` (Priority 1 read — write 짝 없음)

### 1.3 데이터 모델 비대칭 (반드시 인지)

`estimated_band`는 **4밴드**(`user_vocab_profiles` CHECK + `VocabBand` 타입), `known_words.frequency_band`는 **5밴드**(`advanced` 추가)다.

- Reference: `packages/shared/src/types/index.ts:676` (`VocabBand = beginner|basic|conversation|professional` — 4종)
- Reference: `packages/shared/src/types/index.ts:698` (`KnownWord.frequencyBand: VocabBand | "advanced"` — 5종)
- Reference: `supabase/migrations/20260615000100_user_vocab_profiles.sql:4` (estimated_band 4밴드 CHECK) · `supabase/migrations/20260615000200_known_words.sql:5` (frequency_band 5밴드 CHECK)

함의: 어휘 크기 추정이 `advanced` 영역(6001+ lemma)을 나타낼 수 있어도, `estimated_band`로 영속할 때는 **`professional`로 클램프**해야 한다(밴드 풀은 professional이 상한). `known_words`에는 `advanced` 태깅이 허용된다(커버리지 정밀도 보존). 이 비대칭은 측정 스코어러의 명시적 계약이다(REQ-VOCAB-A-U2).

### 1.4 현행 부품 (재사용 — INVIOLABLE KEEP)

INPUT-001/002가 적응형 루프의 *런타임 프리미티브*를 이미 구현했다. 본 SPEC은 이를 **재사용**하며 측정·라이터·루프 결선만 추가한다.

- **런타임 측정 프리미티브:** `reading-coverage.ts` — `tokenizeText(text)`, `calculateUnknownRatio(text, knownLemmas: Set<string>)`, `verifyCoverage(text, knownLemmas): { status, unknownRatio, unknownWords }`.
  - Reference: `apps/web/src/lib/premium/reading-coverage.ts:6-37` (3 함수) · `:4-5` (`tokenizeText` — 형태소 lemmatization 미수행, v1 단순 split, 리스크)
- **적응형 루프 수학:** `vocab-band.ts` — `BAND_WORD_COUNTS`(beginner 500/basic 1500/conversation 3000/professional 6000), `getBandSeedMetadata`(band→CEFR A1/A2/B1/B2), `judgeCoverage(ratio)`→too-easy/optimal/too-hard, `coverageDifficultyAdjustment(ratio)`→-1/0/+1.
  - Reference: `packages/shared/src/lib/vocab-band.ts:6-55` (밴드 단어수·CEFR 맵·judge·adjust)
- **빈도 단어셋(교체 대상):** `band-coverage.ts` — `computeBandCoverage()`·`extractTopicTags()`가 **손-시드 단어셋**(`BEGINNER_SEED`/`BASIC_ADDITIONAL`/… 누적 `BAND_SETS`)을 사용. D3로 정전 리스트 교체.
  - Reference: `apps/web/src/lib/premium/band-coverage.ts:14-953` (손-시드 단어셋 + 누적 `BAND_SETS`, follow-up 플래그됨) · `:977-1003` (`computeBandCoverage` 정전 리스트 소비처)
- **밴드 소비처:** `resolveUserBand()`가 `estimated_band`를 1차로 읽음(라이터만 채우면 변경 없이 실측 적용).
  - Reference: `apps/web/src/app/api/premium/today/route.ts:108-146`
- **per-user 커버리지 게이트(이미 존재, 미사용):** `generateReadingPiece()`는 이미 `knownLemmas?: Set<string>`를 받아 `verifyCoverage()`로 게이트하지만, **populated set을 넘기는 호출자가 없다**(`known_words` 라이터 부재 탓). 본 SPEC이 라이터를 만들면 이 게이트가 실효된다.
  - Reference: `apps/web/src/lib/premium/reading-generation.ts:65` (`knownLemmas?: Set<string>` 입력) · `:252-275` (`verifyCoverage` 게이트 — populated set 호출자 0건)
- **공유 타입:** `UserVocabProfile`·`KnownWord`·`KnownWordSource` 존재.
  - Reference: `packages/shared/src/types/index.ts:678-702`

### 1.5 본 SPEC의 테제: "공급 라인은 깔렸다, 계량기를 단다"

INPUT-002가 *밴드에 맞는 콘텐츠를 공급하는 라인*을 깔았다면, INPUT-003은 *그 사용자의 밴드를 실제로 측정하고, 측정 결과를 영속하며, 세션마다 미세 보정하는* **계량 + 라이터 + 적응 루프**를 정의한다. 핵심은 (a) 온보딩 Yes/No 어휘크기 테스트로 밴드와 seed `known_words`를 동시에 산출하고, (b) 현재 부재한 `user_vocab_profiles`/`known_words` 라이터를 만들어 `resolveUserBand` Priority 1을 실효시키며, (c) 런타임에 `verifyCoverage`→`coverageDifficultyAdjustment`를 **히스테리시스**로 밴드에 반영하는 것이다(D1/D2). 콘텐츠 풀은 밴드-키 유지(D4) — `known_words`는 정밀도 레이어이지 풀 분할이 아니다.

---

## 2. 목표 / 비목표 (Goals / Non-Goals)

### 2.1 Goals

| # | 목표 | 근거 갭 |
|---|------|---------|
| G1 | **빈도 리스트 기반(Foundation)** — 빈도-랭크 lemma 정전 리스트(데이터 자산)가 샘플링·밴드 태깅·커버리지를 단일 소스로 구동. 밴드 분할 규칙·라이선싱 결정 명기. | §1.4 손-시드 교체(D3) |
| G2 | **Yes/No 측정(Assessment)** — 밴드별 N단어 + M의사단어 샘플 → 의사단어 "yes"로 위양성률 산출·보정 → (a) 어휘 크기 추정→`estimated_band`(professional 클램프)+`estimated_level`, (b) seed `known_words`(source='seed', 밴드 태깅) 산출. 수학을 `@MX:ANCHOR` 계약으로 정밀 정의. | §1.2 측정 부재(D1) |
| G3 | **Persist(라이터)** — 현재 부재한 라이터: `user_vocab_profiles` upsert(estimated_band/level + update_history 스냅샷) + `known_words` 벌크 insert(source='seed'). RLS(self_only) 준수, user-token vs admin client 결정. | §1.2 라이터 무(無)(D2) |
| G4 | **Refine(런타임 적응 루프)** — 세션 완료/커버리지 신호에 `verifyCoverage`→`coverageDifficultyAdjustment`→**히스테리시스** 밴드 조정(K연속 동방향 신호 필요, 유효 밴드 클램프) + update_history append. tap-to-gloss `onWordTap(lemma)`→`known_words`(source='tap'). 다 읽은 콘텐츠 inferred(source='inferred')는 선택. | §1.2 루프 부재(D2) |
| G5 | **온보딩 UX 계약** — 테스트 스크린 플로(밴드/스크린 수, 의사단어 배치, 진행률, 중도이탈 폴백). 모바일 스크린은 계약으로만 명세(별도 트랙 조율). | §1.2 + 동시성 노트 |
| G6 | **통합(Integration)** — 본 SPEC은 라이터+측정+루프만 채운다. INPUT-002 풀/조립은 `resolveUserBand`가 실측을 받고 `known_words`가 per-user 랭킹/커버리지 게이트를 먹이는 것 외에는 변경 없음. INPUT-002 KEEP-parts 불가침. | §1.4 KEEP(D4) |

### 2.2 Non-Goals (명시적 제외)

- **콘텐츠 풀 per-user 사전생성:** `known_words`가 per-user 정밀도를 더해도 콘텐츠는 밴드-키 풀 유지(D4). INPUT-002 D3(밴드-레벨 공유 풀) 불변.
- **`resolveUserBand` 우선순위 구조 변경:** 라이터만 채워 Priority 1을 실효시킨다. 우선순위 1→2→3 골격은 KEEP(`today/route.ts:108-146`). 구 `level_band`(Priority 2)는 폴백으로 유지(중도이탈/콜드 스타트 안전망).
- **형태소 lemmatization 엔진 도입:** `tokenizeText`는 v1 단순 split 유지(`reading-coverage.ts:4-7`). 굴절형 정규화(running→run)는 정확도 리스크로 기록하되 본 SPEC에서 풀 lemmatizer를 도입하지 않는다(스코어러는 이 한계를 가정하고 보수적으로 추정).
- **모바일 온보딩 UI 구현:** 모바일 스크린은 **계약(contract)** 으로만 명세. 실제 RN 화면 구현은 `apps/mobile/**`를 편집 중인 별도 세션과 **조율**(별도 트랙). 본 SPEC은 web/shared만 구현 범위.
- **`advanced` 밴드 풀 신설:** 풀 상한은 professional 유지. `advanced`는 `known_words` 태깅 정밀도에만 쓰고 `estimated_band`는 professional로 클램프(§1.3).
- **적응형 난도 아크·관심사 랭킹 고도화:** Refine은 "밴드 너지 + tap 갱신 + 히스테리시스"까지. 워밍업→피크 아크·취향 랭킹은 Out(INPUT-002 세션 조립 v2 영역).
- **다국어/적응형 테스트 길이 최적화(IRT/CAT):** v1은 고정 길이 Yes/No 테스트. 항목반응이론 기반 적응형 테스트(CAT)는 정확도 vs 길이 트레이드오프로 기록하되 Out(`plan.md` 대안 비교).
- **레거시 프리미엄(SPEC-PREMIUM-001) 일체:** INPUT-002 freeze 계승. 자동화/측정은 레거시 테이블·어드민·deprecated 타입에 도달하지 않는다.

---

## 3. EARS 요구사항

> EARS 5종: Ubiquitous(항상), Event-driven(WHEN), State-driven(WHILE), Optional(WHERE), Unwanted(IF/THEN ... shall not). 기술 식별자는 영어로 유지한다. 각 모듈 ≤ 약 6개.
> REQ ID 패턴: `REQ-VOCAB-{모듈문자}-{타입약자}{NN}`.

### REQ-VOCAB-F — 빈도 리스트 기반 (정전 lemma 리스트 단일 소스)

§G1/D3: 빈도-랭크 lemma 정전 리스트(데이터 자산)가 샘플링·밴드 태깅·커버리지의 단일 소스. 현행 손-시드 단어셋 교체.
관련 데이터: 빈도 리스트 데이터 파일(신규, §5), `band-coverage.ts` 소비처(기존, 교체).

- **F-U1 (Ubiquitous):** The system **shall** maintain a single frequency-ranked lemma list as the canonical source for assessment sampling, `known_words` band tagging, and band coverage computation.
  *(시스템은 항상 빈도-랭크 lemma 리스트 1개를 어휘 테스트 샘플링·`known_words` 밴드 태깅·밴드 커버리지 계산의 정전 단일 소스로 유지해야 한다.)*
  - Reference: `apps/web/src/lib/premium/band-coverage.ts:14-953` (현행 손-시드 단어셋 — 교체 대상) · `:977-1003` (`computeBandCoverage` 소비처)
- **F-U2 (Ubiquitous):** The system **shall** partition the list into bands by frequency rank — beginner = rank 1–500, basic = 501–1500, conversation = 1501–3000, professional = 3001–6000, advanced = 6001+ — and a lemma's band is determined solely by its rank.
  *(시스템은 항상 리스트를 빈도 랭크로 밴드 분할해야 한다: beginner=상위500, basic=501–1500, conversation=1501–3000, professional=3001–6000, advanced=6001+. lemma의 밴드는 오직 랭크로 결정된다.)*
  - Reference: `packages/shared/src/lib/vocab-band.ts:6-11` (`BAND_WORD_COUNTS` 누적 상한과 정합) · `apps/web/src/lib/premium/band-coverage.ts:6-8` (누적 커버리지 주석 — beginner=500..professional=6000)
- **F-U3 (Ubiquitous):** The system **shall** keep `computeBandCoverage()` and `extractTopicTags()` consuming the canonical list with cumulative semantics preserved (professional ⊇ conversation ⊇ basic ⊇ beginner).
  *(시스템은 항상 `computeBandCoverage()`/`extractTopicTags()`가 정전 리스트를 소비하되 누적 의미(professional ⊇ conversation ⊇ basic ⊇ beginner)를 보존하도록 유지해야 한다.)*
  - Reference: `apps/web/src/lib/premium/band-coverage.ts:938-1003` (누적 `BAND_SETS` + `computeBandCoverage` — 손-시드를 리스트 백엔드로 교체하되 시그니처·누적 의미 KEEP)
- **F-W1 (State-driven, WHILE):** WHILE the canonical list is loaded, THEN the system **shall** treat list load failure as fatal for assessment (no silent fallback to incomplete hand-seeded sets that would corrupt band estimates).
  *(WHILE 정전 리스트 로드 중, THEN 시스템은 리스트 로드 실패를 어휘 테스트에 치명으로 취급해야 한다 — 밴드 추정을 오염시킬 불완전 손-시드 셋으로 조용히 폴백하지 않는다.)*
- **F-U4 (Unwanted, IF/THEN):** IF the chosen list carries a non-permissive license, THEN the system **shall not** ship it without an explicit licensing decision recorded (prefer a permissively-licensed list).
  *(IF 선택 리스트가 비투과 라이선스라면, THEN 시스템은 명시적 라이선싱 결정 기록 없이 이를 배포하지 않아야 한다 — 투과 라이선스 리스트 선호.)*
  - Reference: `apps/web/src/lib/premium/band-coverage.ts:15-18` (현행 "production: full 6000-word list 필요" 주석 — 본 SPEC의 라이선싱 결정 대상)

### REQ-VOCAB-A — Yes/No 측정 스코어링 (의사단어 위양성 보정)

§G2/D1: 밴드별 N단어 + M의사단어 샘플 → 위양성 보정 → 어휘 크기 추정 + seed `known_words` 산출. 수학을 정밀 정의(`@MX:ANCHOR` 계약).
관련 데이터: 빈도 리스트(REQ-VOCAB-F), 측정 입력(사용자 know/don't-know 응답).

- **A-E1 (Event-driven, WHEN):** WHEN a user submits Yes/No answers for the sampled real words and pseudowords, THEN the system **shall** compute a false-positive rate from pseudoword "yes" answers, correct the raw "known" estimate, and produce (a) an estimated vocabulary size and (b) the seed known-word set.
  *(WHEN 사용자가 샘플 실단어·의사단어에 Yes/No를 제출하면, THEN 시스템은 의사단어 "yes"로 위양성률을 산출해 원(raw) 추정을 보정하고 (a) 추정 어휘 크기와 (b) seed known-word 셋을 산출해야 한다.)*
- **A-U1 (Ubiquitous):** The system **shall** define the scoring math as the canonical contract: for each band, `hitRate = yesOnRealWords / realWordsInBand`; `falsePositiveRate = yesOnPseudowords / pseudowordCount`; corrected per-band known fraction = `max(0, (hitRate − falsePositiveRate) / (1 − falsePositiveRate))`; estimated size = Σ over bands of (corrected fraction × band width).
  *(시스템은 항상 스코어링 수학을 정전 계약으로 정의해야 한다: 밴드별 `hitRate = 실단어yes / 밴드내실단어수`; `falsePositiveRate = 의사단어yes / 의사단어수`; 보정 known 비율 = `max(0, (hitRate − fpr) / (1 − fpr))`; 추정 크기 = Σ밴드(보정비율 × 밴드 폭). 밴드 폭: beginner 500, basic 1000, conversation 1500, professional 3000.)*
  - Reference: `packages/shared/src/lib/vocab-band.ts:6-11` (밴드 누적 상한 → 폭 = 차분: 500/1000/1500/3000)
- **A-U2 (Ubiquitous):** The system **shall** map the corrected estimated vocabulary size to `estimated_band` (4-band, clamped to professional) and `estimated_level` (CEFR via `getBandSeedMetadata`), never emitting `advanced` for `estimated_band`.
  *(시스템은 항상 보정 추정 어휘 크기를 `estimated_band`(4밴드, professional 클램프)와 `estimated_level`(CEFR, `getBandSeedMetadata`)로 매핑하고, `estimated_band`로 `advanced`를 산출하지 않아야 한다.)*
  - Reference: `supabase/migrations/20260615000100_user_vocab_profiles.sql:4` (4밴드 CHECK) · `packages/shared/src/lib/vocab-band.ts:22-38` (`getBandSeedMetadata` band→CEFR) · `packages/shared/src/types/index.ts:676` (`VocabBand` 4종)
- **A-U3 (Ubiquitous):** The system **shall** emit seed known-words tagged with `frequency_band` per the lemma's rank (5-band, `advanced` allowed) and `source='seed'`, restricted to real words the user marked "known" (pseudowords never enter `known_words`).
  *(시스템은 항상 seed known-word를 lemma 랭크 기준 `frequency_band`(5밴드, `advanced` 허용) + `source='seed'`로 태깅해 산출하되, 사용자가 "안다"고 표기한 **실단어만** 포함해야 한다 — 의사단어는 절대 `known_words`에 들어가지 않는다.)*
  - Reference: `supabase/migrations/20260615000200_known_words.sql:5-6` (frequency_band 5밴드 + source enum) · `packages/shared/src/types/index.ts:698` (`KnownWord.frequencyBand: VocabBand | "advanced"`)
- **A-W1 (State-driven, WHILE):** WHILE computing the false-positive correction, IF `falsePositiveRate ≥ 1` or the denominator is zero, THEN the system **shall** clamp the correction safely (no division-by-zero, no negative known fraction) and degrade to a conservative band estimate.
  *(WHILE 위양성 보정 계산 중, IF `fpr ≥ 1` 또는 분모 0이면, THEN 시스템은 보정을 안전 클램프(0나눗셈·음수 비율 금지)하고 보수적 밴드 추정으로 강등해야 한다.)*
- **A-U4 (Unwanted, IF/THEN):** IF the pseudoword false-positive rate exceeds an over-claim threshold (e.g., > 0.5), THEN the system **shall not** trust the raw hit rate and **shall** down-rank the band estimate (over-claiming user gets a conservative band, not an inflated one).
  *(IF 의사단어 위양성률이 과대표기 임계(예: > 0.5)를 넘으면, THEN 시스템은 원 hit rate를 신뢰하지 않고 밴드 추정을 하향해야 한다 — 과대표기 사용자는 부풀린 밴드가 아니라 보수적 밴드를 받는다.)*

### REQ-VOCAB-P — Persist (현재 부재 라이터)

§G3/D2: `user_vocab_profiles`·`known_words` 라이터를 만든다(현행 무). RLS(self_only) 준수.
관련 데이터: `user_vocab_profiles`(기존, 무라이터), `known_words`(기존, 무라이터).

- **P-E1 (Event-driven, WHEN):** WHEN assessment scoring completes, THEN the system **shall** upsert one `user_vocab_profiles` row (`estimated_band`, `estimated_level`, appending a scored snapshot to `update_history`) keyed by `UNIQUE(user_id)`.
  *(WHEN 측정 스코어링이 끝나면, THEN 시스템은 `user_vocab_profiles` row 1개를 `UNIQUE(user_id)` 키로 upsert해야 한다 — `estimated_band`·`estimated_level` + `update_history`에 스코어 스냅샷 append.)*
  - Reference: `supabase/migrations/20260615000100_user_vocab_profiles.sql:6,9` (`update_history jsonb DEFAULT '[]'`, `UNIQUE(user_id)`) · `apps/web/src/app/api/premium/today/route.ts:117-128` (read만 존재 — write 짝 신규)
- **P-E2 (Event-driven, WHEN):** WHEN assessment scoring completes, THEN the system **shall** bulk-insert seed known-words into `known_words` (`source='seed'`, `frequency_band` per lemma) respecting `UNIQUE(user_id, lemma)` (idempotent re-seed via upsert/on-conflict, no duplicate-key failure).
  *(WHEN 측정 스코어링이 끝나면, THEN 시스템은 seed known-word를 `known_words`에 벌크 insert해야 한다 — `source='seed'`, lemma별 `frequency_band`, `UNIQUE(user_id, lemma)` 준수(재시드 시 on-conflict idempotent, 중복키 실패 금지).)*
  - Reference: `supabase/migrations/20260615000200_known_words.sql:9` (`UNIQUE(user_id, lemma)`)
- **P-U1 (Ubiquitous):** The system **shall** honor RLS (`self_only`) on both tables: writes execute under the authenticated user's identity (user-token client) OR, if an admin/service client is used, **shall** explicitly scope every write to the assessed `user_id`.
  *(시스템은 항상 두 테이블의 RLS(`self_only`)를 준수해야 한다: 인증 사용자 신원(user-token client)으로 write하거나, admin/service client를 쓰면 모든 write를 측정 대상 `user_id`로 명시 스코프해야 한다.)*
  - Reference: `supabase/migrations/20260615000100_user_vocab_profiles.sql:12` · `supabase/migrations/20260615000200_known_words.sql:12` (`self_only` = `auth.uid() = user_id`)
- **P-W1 (State-driven, WHILE):** WHILE persisting, THEN the system **shall** make profile upsert and known-words insert atomic-or-recoverable: a partial failure (profile written, known-words not) **shall** be detectable and retryable without leaving an inconsistent band-without-seed state silently.
  *(WHILE 영속 중, THEN 시스템은 프로필 upsert와 known-words insert를 atomic-or-recoverable로 처리해야 한다 — 부분 실패(프로필만 기록, known-words 누락)가 탐지·재시도 가능하고, 밴드-without-seed 불일치를 조용히 남기지 않는다.)*
- **P-U2 (Unwanted, IF/THEN):** IF the write path attempts to insert a pseudoword or a lemma the user did not mark "known", THEN the system **shall not** persist it to `known_words`.
  *(IF write 경로가 의사단어 또는 사용자가 "안다"고 표기하지 않은 lemma를 insert하려 하면, THEN 시스템은 이를 `known_words`에 영속하지 않아야 한다.)*

### REQ-VOCAB-R — Refine (런타임 적응 루프 + 히스테리시스)

§G4/D2: 세션 완료/커버리지 신호에 `verifyCoverage`→`coverageDifficultyAdjustment`→히스테리시스 밴드 조정 + tap 갱신. 기존 런타임 프리미티브 재사용.
관련 데이터: `user_vocab_profiles`(update_history), `known_words`(tap/inferred), `ci_sessions`(세션 신호).

- **R-E1 (Event-driven, WHEN):** WHEN a coverage signal is available for a user's session content (via `verifyCoverage(content, knownLemmas)`), THEN the system **shall** compute a difficulty direction via `coverageDifficultyAdjustment(unknownRatio)` (−1/0/+1) and record it as a directional vote for that user.
  *(WHEN 사용자 세션 콘텐츠의 커버리지 신호가 `verifyCoverage(content, knownLemmas)`로 가용하면, THEN 시스템은 `coverageDifficultyAdjustment(unknownRatio)`(−1/0/+1)로 난도 방향을 산출하고 해당 사용자의 방향 투표로 기록해야 한다.)*
  - Reference: `apps/web/src/lib/premium/reading-coverage.ts:28-37` (`verifyCoverage`) · `packages/shared/src/lib/vocab-band.ts:43-55` (`judgeCoverage`/`coverageDifficultyAdjustment`)
- **R-W1 (State-driven, WHILE):** WHILE adjusting `estimated_band`, THEN the system **shall** apply hysteresis: require K consecutive same-direction votes (K configurable, default ≥ 3) before flipping the band by one step, and **shall** clamp to valid 4-band range (no flip below beginner / above professional).
  *(WHILE `estimated_band` 조정 중, THEN 시스템은 히스테리시스를 적용해야 한다: 밴드를 한 단계 뒤집기 전에 K연속 동방향 투표(K 설정값, 기본 ≥3)를 요구하고, 유효 4밴드 범위로 클램프(beginner 미만/professional 초과 금지)해야 한다.)*
  - Reference: `packages/shared/src/lib/vocab-band.ts:6-11` (밴드 4종 순서) · `supabase/migrations/20260615000100_user_vocab_profiles.sql:4` (4밴드 CHECK)
- **R-E2 (Event-driven, WHEN):** WHEN the band is flipped, THEN the system **shall** append a snapshot to `update_history` (`{ timestamp, reason, previousBand }`) and reset the directional vote counter.
  *(WHEN 밴드가 뒤집히면, THEN 시스템은 `update_history`에 스냅샷(`{ timestamp, reason, previousBand }`)을 append하고 방향 투표 카운터를 리셋해야 한다.)*
  - Reference: `packages/shared/src/types/index.ts:683-687` (`updateHistory` 구조 — `{ timestamp, reason, previousBand? }`)
- **R-E3 (Event-driven, WHEN):** WHEN the user taps a word for a gloss (`onWordTap(lemma)`), THEN the system **shall** insert/upsert that lemma into `known_words` with `source='tap'` and `last_seen=now()` (the user demonstrably encountered/learned it).
  *(WHEN 사용자가 단어를 탭해 글로스를 보면(`onWordTap(lemma)`), THEN 시스템은 그 lemma를 `known_words`에 `source='tap'` + `last_seen=now()`로 insert/upsert해야 한다.)*
  - Reference: `supabase/migrations/20260615000200_known_words.sql:6-7` (`source` 'tap' enum + `last_seen`)
- **R-O1 (Optional, WHERE):** WHERE a piece of content is fully read/completed, the system **may** infer its tokens as known and insert them with `source='inferred'` (lower-confidence than seed/tap).
  *(WHERE 콘텐츠 1편을 완독/완료한 경우, 시스템은 그 토큰을 known으로 추론해 `source='inferred'`로 insert할 수 있다(seed/tap보다 낮은 신뢰).)*
  - Reference: `supabase/migrations/20260615000200_known_words.sql:6` (`source` 'inferred' enum)
- **R-U1 (Unwanted, IF/THEN):** IF `known_words` is empty (cold start before any seed/tap), THEN the system **shall not** crash or compute a misleading 0%-coverage; it **shall** fall back to band-set coverage (`computeBandCoverage`) so the loop degrades gracefully until seeds exist.
  *(IF `known_words`가 비어 있으면(seed/tap 전 콜드 스타트), THEN 시스템은 크래시하거나 오인성 0% 커버리지를 산출하지 않아야 한다 — `computeBandCoverage` 밴드-셋 커버리지로 폴백해 seed가 생길 때까지 우아하게 강등해야 한다.)*
  - Reference: `apps/web/src/lib/premium/reading-coverage.ts:16-18` (빈 토큰 시 unknownRatio 0 반환 — 빈 set 시 전부 unknown 되는 함정) · `apps/web/src/lib/premium/band-coverage.ts:977-1003` (`computeBandCoverage` 폴백 소스)

### REQ-VOCAB-I — 통합 & 온보딩 UX 계약

§G5/G6/D4: 라이터+측정+루프만 채운다. INPUT-002 풀/조립은 `resolveUserBand` 실측 + `known_words` per-user 게이트 외 불변. 모바일 온보딩은 계약.
관련: `today/route.ts`(KEEP), `reading-generation.ts`(게이트 실효), 모바일 온보딩(계약).

- **I-U1 (Ubiquitous):** The system **shall** confine its changes to the measurement, writers, and adaptive loop; it **shall not** alter the INPUT-002 band-keyed pool or per-user assembly except that `resolveUserBand` now receives real `estimated_band` data and `known_words` now feeds the per-user reading coverage gate.
  *(시스템은 항상 변경을 측정·라이터·적응 루프로 한정해야 한다 — `resolveUserBand`가 실측 `estimated_band`를 받고 `known_words`가 per-user 리딩 커버리지 게이트를 먹이는 것 외에 INPUT-002 밴드-키 풀/조립을 변경하지 않아야 한다.)*
  - Reference: `apps/web/src/app/api/premium/today/route.ts:108-146` (`resolveUserBand` 우선순위 골격 KEEP) · `apps/web/src/lib/premium/reading-generation.ts:65,252-275` (`knownLemmas` 게이트 — populated set 공급으로 실효)
- **I-E1 (Event-driven, WHEN):** WHEN per-user reading is generated/validated with a populated `knownLemmas` set (from `known_words`), THEN the system **shall** feed that set to the existing `verifyCoverage` gate in `generateReadingPiece()` without changing its signature.
  *(WHEN populated `knownLemmas` 셋(`known_words` 유래)으로 per-user 리딩이 생성/검증되면, THEN 시스템은 그 셋을 `generateReadingPiece()`의 기존 `verifyCoverage` 게이트에 시그니처 변경 없이 먹여야 한다.)*
  - Reference: `apps/web/src/lib/premium/reading-generation.ts:65` (`knownLemmas?: Set<string>` 기존 입력) · `:252-275` (게이트)
- **I-U2 (Ubiquitous):** The system **shall** specify the mobile onboarding test as a CONTRACT (screen flow, band/screen counts, pseudoword placement, progress, abandonment fallback) and **shall not** assume its implementation lives in this SPEC's web/shared scope.
  *(시스템은 항상 모바일 온보딩 테스트를 계약(스크린 플로·밴드/스크린 수·의사단어 배치·진행률·중도이탈 폴백)으로 명세해야 하며, 그 구현이 본 SPEC web/shared 범위에 있다고 가정하지 않아야 한다.)*
  - Reference: `apps/mobile/app/onboarding.tsx:46,52,54-58` (현행 `OnboardingStep`·`STEP_SEQUENCE`·4지선다 `LEVEL_OPTIONS` — 어휘 테스트 스텝이 이를 대체/보강하는 계약)
- **I-W1 (State-driven, WHILE):** WHILE the user abandons the onboarding test before completion, THEN the system **shall** fall back to a coarse default band (existing `level_band` self-report if present, else `conversation`) without persisting a partial/garbage `user_vocab_profiles` row.
  *(WHILE 사용자가 온보딩 테스트를 완료 전 중도이탈하는 동안, THEN 시스템은 부분/쓰레기 `user_vocab_profiles` row를 영속하지 않고 coarse 기본 밴드(있으면 기존 `level_band`, 없으면 `conversation`)로 폴백해야 한다.)*
  - Reference: `apps/web/src/app/api/premium/today/route.ts:130-145` (Priority 2 `level_band` / Priority 3 `conversation` 폴백 — KEEP)
- **I-U3 (Unwanted, IF/THEN):** IF this SPEC's implementation attempts to edit `apps/mobile/**` onboarding UI directly, THEN it **shall not** do so blindly; mobile UI changes are coordinated with the concurrent mobile session as a separate track.
  *(IF 본 SPEC 구현이 `apps/mobile/**` 온보딩 UI를 직접 편집하려 하면, THEN 맹목 편집하지 않아야 한다 — 모바일 UI 변경은 동시 작업 중인 모바일 세션과 별도 트랙으로 조율한다.)*

---

## 4. Traceability

| 요구 모듈 | 갭 근거 | 신규/확장 데이터 | 핵심 재사용(KEEP) | 구현 트랙 |
|---|---|---|---|---|
| REQ-VOCAB-F 빈도 리스트 | §1.4(D3) | 빈도 리스트 데이터 파일(신규), `band-coverage.ts` 백엔드 교체 | `computeBandCoverage`/`extractTopicTags` 시그니처·누적 의미 | web/shared (안전) |
| REQ-VOCAB-A 측정 스코어링 | §1.2(D1) | 측정 스코어러 모듈(신규) | `vocab-band.ts`(BAND_WORD_COUNTS·getBandSeedMetadata) | shared (안전) |
| REQ-VOCAB-P Persist 라이터 | §1.2(D2) | `user_vocab_profiles`·`known_words` 라이터 + API 라우트(신규) | 두 테이블(기존)·RLS self_only | web (안전) |
| REQ-VOCAB-R Refine 루프 | §1.2(D2) | 적응 루프 모듈 + tap 라이터(신규), update_history | `verifyCoverage`·`coverageDifficultyAdjustment`·`computeBandCoverage` 폴백 | web/shared (안전) |
| REQ-VOCAB-I 통합·UX 계약 | §1.4/동시성(D4) | (없음 — 제약·계약) | `resolveUserBand`·`generateReadingPiece` knownLemmas 게이트 | web(통합) + 모바일(계약, 조율) |

> **INVIOLABLE KEEP:** `reading-coverage.ts`(tokenize/calculateUnknownRatio/verifyCoverage), `vocab-band.ts`(BAND_WORD_COUNTS/getBandSeedMetadata/judgeCoverage/coverageDifficultyAdjustment), `resolveUserBand` 우선순위 골격, `generateReadingPiece` 시그니처(특히 `knownLemmas?` 입력), `computeBandCoverage`/`extractTopicTags` 시그니처는 절대 제거하지 않고 백엔드/호출자만 결선한다.
> **DATA-MODEL 불변식:** `estimated_band`는 4밴드(professional 클램프), `known_words.frequency_band`는 5밴드(`advanced` 허용). 의사단어는 절대 `known_words`에 영속되지 않는다.
> **SCOPE 분리:** 측정·스코어·라이터·API·루프 = `apps/web` + `packages/shared`(고립 구현 안전). 모바일 온보딩 UI = 계약(별도 트랙 조율, `apps/mobile/**` 맹목 편집 금지).
> **INVIOLABLE FREEZE(계승):** INPUT-002 freeze — 레거시 프리미엄 테이블·어드민·deprecated 타입은 측정/루프가 절대 읽거나 쓰지 않는다.

상세 구현 계획은 `plan.md`, 인수 기준은 `acceptance.md`를 참조한다.
