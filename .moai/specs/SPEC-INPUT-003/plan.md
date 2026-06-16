# SPEC-INPUT-003 구현 계획 (plan.md)

> 근거: `spec.md` EARS 요구, SPEC-INPUT-001/002 코드베이스(plan phase ground truth). 방법론 = **TDD**(`.moai/config/sections/quality.yaml` `development_mode: tdd`). 측정·스코어·라이터·루프는 fixture/순수함수 테스트 우선.
> 일정 표현은 시간 단위 대신 우선순위·의존 순서(Primary/Secondary/Final Goal)로 기술한다.
> **구현 트랙 분리:** Phase 0~4(측정·라이터·루프·통합)는 **`apps/web` + `packages/shared` 전용 = 고립 구현 안전**. Phase 5(모바일 온보딩 UI)는 **계약만 정의**, 실제 RN 구현은 `apps/mobile/**` 동시 편집 세션과 **조율(별도 트랙)**.

---

## 1. 아키텍처 결정: Seed → Persist → Refine 3단계 (D2)

> Philosopher 프레임워크 적용: assumption audit → first principles → alternatives → trade-off → 결정. 본 결정은 사용자가 확정(D2)했으며, 본 절은 그 근거·대안·트레이드오프를 기록한다.

### 1.1 First principle

밴드는 "사용자가 *주장*하는 레벨"이 아니라 "사용자가 *실제로 아는 단어의 빈도 분포*"다. 자기보고(현행 `level_band` 4지선다)는 과대/과소 표기 편향이 크다. 따라서 밴드의 자연 단위는 *선언*이 아니라 *측정된 어휘 분포*이며, 측정은 한 번(seed)으로 끝나지 않고 사용자가 콘텐츠를 소비하며 *변화*(refine)한다.

### 1.2 측정 방식 대안 비교 (Diverge → Converge, D1)

| 옵션 | 설명 | 길이/마찰 | 정확도 | 위양성 통제 | 트레이드오프 |
|---|---|---|---|---|---|
| A. 자기보고 4지선다(현행) | "거의 못해요~업무 가능" 택1 | 최저(1탭) | 낮음 | 없음 | 편향 큼. 현행 갭(§1.2) |
| B. 객관식 문맥 어휘 퀴즈 | 문장 빈칸 N문항 | 높음(독해 부하) | 중 | 약함(추측) | 마찰↑·이탈↑, 문항 저작 비용 |
| **C. Yes/No 어휘크기 테스트 + 의사단어 ★채택(D1)** | 실단어 ~40 + 의사단어 M, know/don't-know | 낮음(빠른 탭) | 중상 | **강함(의사단어 위양성 보정)** | 굴절형 모호(lemmatization 갭) — 보수적 추정으로 흡수 |
| D. IRT/CAT 적응형 테스트 | 항목반응이론, 응답에 따라 다음 문항 선택 | 가변(짧을 수 있음) | 상 | 강함 | 모델·캘리브레이션 비용 큼. Out(비목표), v2 후보 |

**채택 근거(Trade-off):** Yes/No 어휘크기 테스트는 (a) 마찰이 낮아 온보딩 이탈을 최소화하고, (b) 의사단어로 과대표기를 **정량 보정**(REQ-VOCAB-A)하며, (c) 결과가 밴드 + seed `known_words`를 **동시에** 산출해 Persist 단계로 자연 연결된다. 정확도-길이 곡선의 sweet spot이 ~40실단어 + 소수 의사단어. IRT/CAT(옵션 D)는 정확도는 높지만 캘리브레이션 비용이 v1 범위를 초과(비목표).

### 1.3 3단계 데이터 흐름

```
[Seed]  온보딩 Yes/No 테스트
          │  실단어yes / 의사단어yes
          ▼
        스코어러(REQ-VOCAB-A, 순수함수, packages/shared)
          │  ├─ 위양성 보정 → 추정 어휘크기 → estimated_band(prof 클램프)+estimated_level
          │  └─ "안다"고 표기한 실단어 → seed known_words(source='seed', 밴드 태깅)
          ▼
[Persist] 라이터(REQ-VOCAB-P, API route, apps/web)  ← 현재 부재
          │  ├─ upsert user_vocab_profiles (UNIQUE(user_id), update_history append)
          │  └─ bulk insert known_words (UNIQUE(user_id,lemma) on-conflict)
          ▼
[Refine] 런타임 루프(REQ-VOCAB-R, apps/web + shared)
          ├─ 세션 신호: verifyCoverage(content, knownLemmas) → coverageDifficultyAdjustment(-1/0/+1)
          │            → 히스테리시스(K연속) → estimated_band ±1 클램프 → update_history append
          ├─ tap-to-gloss: onWordTap(lemma) → known_words(source='tap', last_seen=now())
          └─ (선택) 완독 → known_words(source='inferred')
          ▼
[소비, 변경 없음] resolveUserBand() Priority 1 = estimated_band (실측)  ← INPUT-002 KEEP
                 generateReadingPiece(knownLemmas) 커버리지 게이트 실효  ← INPUT-002 KEEP
```

### 1.4 현행 코드와의 정합

- `resolveUserBand()`는 이미 `estimated_band`를 Priority 1로 읽는다(`today/route.ts:117-128`). 라이터만 채우면 **today route 변경 없이** 실측이 적용된다.
- `generateReadingPiece()`는 이미 `knownLemmas?: Set<string>` 게이트를 가진다(`reading-generation.ts:65,252-275`). populated set만 공급하면 **시그니처 변경 없이** per-user 커버리지가 실효된다.
- `update_history` 구조(`{ timestamp, reason, previousBand? }`)는 이미 타입에 정의됨(`types/index.ts:683-687`) — Refine 스냅샷이 그대로 들어맞는다.

---

## 2. 데이터 모델 델타 (현행 마이그레이션 기준)

> 현행 스키마는 plan phase 확인. **테이블 변경은 거의 없다 — 라이터가 없을 뿐 스키마는 이미 존재한다.**

### 2.1 `user_vocab_profiles` — 스키마 변경 없음, 라이터만 신규 (REQ-VOCAB-P)

현행(`20260615000100_user_vocab_profiles.sql:1-12`): `{ user_id UNIQUE, estimated_band(4밴드 CHECK), estimated_level DEFAULT 'A2', update_history jsonb DEFAULT '[]', self_only RLS }`. **변경 없음.** 신규는 upsert 라이터 + update_history append 로직.

### 2.2 `known_words` — 스키마 변경 없음, 라이터만 신규 (REQ-VOCAB-P/R)

현행(`20260615000200_known_words.sql:1-12`): `{ user_id, lemma, frequency_band(5밴드 CHECK), source('seed'/'tap'/'inferred'), last_seen, UNIQUE(user_id,lemma), self_only RLS }`. **변경 없음.** 신규는 seed 벌크 insert + tap/inferred upsert(on-conflict) 라이터.

### 2.3 빈도 리스트 데이터 파일 — 신규 (REQ-VOCAB-F)

| 항목 | 내용 | 사유 |
|---|---|---|
| 위치(후보) | `packages/shared/src/data/frequency-lemmas.{ts\|json}` 또는 `apps/web/src/lib/premium/data/` | 샘플링·밴드 태깅·커버리지 공통 소비 → shared 선호 |
| 형식 | rank-ordered lemma 배열(또는 `{ lemma, rank }`), 상위 ~6000 | 밴드 분할은 rank로만 결정(F-U2) |
| 밴드 분할 | beginner 1–500 / basic 501–1500 / conversation 1501–3000 / professional 3001–6000 / advanced 6001+ | `BAND_WORD_COUNTS` 누적 상한과 정합 |
| 소비 교체 | `band-coverage.ts`의 손-시드 `BAND_SETS`를 리스트 백엔드로 교체(시그니처 KEEP) | F-U3 |
| 라이선싱 | **결정 필요** — 투과 라이선스 리스트 선호(§리스크 R1) | F-U4 |

### 2.4 `ci_sessions` / 풀 / 조립 — 변경 없음 (INPUT-002 KEEP)

세션 조립·풀·캐시 구조는 INPUT-002 그대로. Refine은 세션 *신호*를 읽어 프로필을 갱신할 뿐 조립 경로를 바꾸지 않는다.

---

## 3. 빌드 Phase 분해 (의존 순서)

### Phase 0 — 빈도 리스트 기반 (Primary Goal, REQ-VOCAB-F) · web/shared
모든 후속 단계(샘플링·밴드 태깅·커버리지)의 단일 소스. 가장 독립적이고 선행 필수.

- **Task 0.1** 라이선싱 결정: 투과 라이선스 빈도 리스트 선정(후보 조사·WebFetch로 라이선스 확인). 결정 기록(R1).
- **Task 0.2** 데이터 파일 도입: rank-ordered lemma 리스트 `packages/shared/src/data/`에 배치 + 로더(`getLemmaRank(lemma)`, `lemmasInBand(band)`, `bandForRank(rank)`).
- **Task 0.3** `band-coverage.ts` 백엔드 교체: 손-시드 `BAND_SETS`(`band-coverage.ts:20-953`) → 리스트 기반 누적 셋. `computeBandCoverage`/`extractTopicTags` 시그니처·누적 의미 KEEP(F-U3).
- **Task 0.4** 로드 실패 fatal 처리(F-W1): 리스트 미로드 시 어휘 테스트 차단(조용한 손-시드 폴백 금지).
- **TDD:** `bandForRank` 경계(500/1500/3000/6000), 누적 커버리지 단조성, 리스트 로드 실패 fatal 테스트 우선(RED)→구현(GREEN).

### Phase 1 — Yes/No 측정 스코어러 (Primary Goal, REQ-VOCAB-A) · shared(순수함수)
순수 함수 — DB·UI 없이 단위 테스트 가능. 라이터(Phase 2)가 소비.

- **Task 1.1** 샘플러: 빈도 리스트에서 밴드별 N 실단어 + M 의사단어 셋 구성(의사단어 생성/고정 리스트). 의사단어는 실단어와 음운적으로 그럴듯하되 사전에 없는 형태.
- **Task 1.2** 스코어러(`@MX:ANCHOR` 계약, REQ-VOCAB-A-U1): 밴드별 `hitRate`·`falsePositiveRate`·보정 known 비율(`max(0,(hit−fpr)/(1−fpr))`)·추정 크기(Σ 보정비율×밴드폭).
- **Task 1.3** 밴드 매핑(A-U2): 추정 크기 → `estimated_band`(professional 클램프) + `estimated_level`(`getBandSeedMetadata` CEFR). `advanced` 미산출.
- **Task 1.4** seed known_words 산출(A-U3): "안다"고 표기한 **실단어만** lemma 랭크 기준 5밴드 태깅(`advanced` 허용). 의사단어 제외.
- **Task 1.5** 안전 클램프(A-W1/A-U4): `fpr≥1`/분모 0 안전 처리, 과대표기(fpr>0.5) 시 보수적 하향.
- **TDD:** 위양성 보정 수학(0나눗셈·음수 클램프), 과대표기 하향, professional 클램프, 의사단어 제외 테스트 우선.

### Phase 2 — Persist 라이터 + API (Secondary Goal, REQ-VOCAB-P) · web
현재 부재 라이터. Phase 1 산출을 영속. Phase 3(조립 소비)이 의존.

- **Task 2.1** RLS 클라이언트 결정(P-U1): user-token client(권장, self_only 자동 충족) vs admin client(every write를 user_id 스코프). 결정 기록.
- **Task 2.2** 프로필 라이터(P-E1): `user_vocab_profiles` upsert(`UNIQUE(user_id)`), `update_history`에 스코어 스냅샷 append.
- **Task 2.3** known_words 라이터(P-E2): seed 벌크 insert, `UNIQUE(user_id,lemma)` on-conflict(idempotent 재시드). 의사단어/미표기 lemma 차단(P-U2).
- **Task 2.4** 측정 제출 API 라우트: 온보딩 응답 수신 → 스코어러(Phase 1) → 라이터(2.2/2.3). atomic-or-recoverable(P-W1, 부분 실패 탐지·재시도).
- **TDD:** upsert idempotency, on-conflict 재시드, 의사단어 영속 차단, RLS 스코프, 부분 실패 복구 테스트 우선. fixture-mode로 DB 격리(또는 테스트 supabase).

### Phase 3 — Refine 런타임 적응 루프 (Secondary Goal, REQ-VOCAB-R) · web/shared
세션 신호로 프로필 갱신 + tap 라이터. Phase 0~2 산출(리스트·스코어·라이터)에 의존.

- **Task 3.1** 방향 투표(R-E1): 세션 콘텐츠 `verifyCoverage`→`coverageDifficultyAdjustment`(-1/0/+1) 산출·기록.
- **Task 3.2** 히스테리시스 밴드 조정(R-W1, 순수함수 권장): K연속 동방향(기본 ≥3) → 밴드 ±1, 4밴드 클램프. 투표 상태 저장 위치(update_history 또는 별도 카운터).
- **Task 3.3** 밴드 플립 영속(R-E2): `update_history` 스냅샷 append + 카운터 리셋.
- **Task 3.4** tap 라이터(R-E3): `onWordTap(lemma)` → `known_words` upsert(source='tap', last_seen=now()).
- **Task 3.5** inferred(선택, R-O1): 완독 콘텐츠 토큰 → source='inferred'.
- **Task 3.6** 콜드 스타트 폴백(R-U1): `known_words` 비었을 때 빈 set의 함정(전부 unknown) 회피 → `computeBandCoverage` 밴드-셋 폴백.
- **TDD:** 히스테리시스(K 미만 시 무플립, K 도달 시 플립·리셋), 밴드 클램프, tap upsert, 빈 known_words 폴백 테스트 우선.

### Phase 4 — 통합 (Final Goal, REQ-VOCAB-I) · web
기존 소비처에 실측·게이트 결선. 모든 Phase에 의존.

- **Task 4.1** knownLemmas 공급(I-E1): per-user 리딩 생성 시 `known_words`→`Set<string>`을 `generateReadingPiece({ knownLemmas })`에 공급(시그니처 KEEP). 빈 set 함정 회피.
- **Task 4.2** resolveUserBand 무변경 검증(I-U1): 라이터 채운 후 Priority 1이 실효되는지 회귀 테스트(today route 코드 변경 0).
- **Task 4.3** 중도이탈 폴백(I-W1): 미완료 시 부분 프로필 미영속 → 기존 `level_band`/`conversation` 폴백 유지.
- **TDD:** 실측 적용 회귀, 빈 set 함정 회피, 중도이탈 무영속 테스트 우선.

### Phase 5 — 온보딩 UX 계약 (Final Goal, REQ-VOCAB-I) · 모바일(계약, 조율)
**구현 아님 — 계약만.** 실제 RN 화면은 `apps/mobile/**` 동시 세션과 조율(별도 트랙). 본 SPEC은 계약 문서만 산출.

- **계약 C5.1** 스크린 플로: 현행 `OnboardingStep`(`onboarding.tsx:46,52`)에 어휘 테스트 스텝 삽입/대체. 4지선다 `LEVEL_OPTIONS`(`:54-58`)는 폴백으로 강등 가능(중도이탈 안전망).
- **계약 C5.2** 밴드/스크린 수: 실단어 ~40(밴드별 분배) + 의사단어 M, 1~수 스크린으로 청크. 의사단어는 분산 배치(연속 노출 회피, 과대표기 정직 유도).
- **계약 C5.3** 진행률·중도이탈: 진행 표시 + 중도이탈 시 부분응답 미제출(부분 프로필 미영속, I-W1).
- **계약 C5.4** 제출 페이로드: `{ answers: Array<{ token, isReal, known }> }` → Phase 2 API. 토큰의 isReal/밴드 매핑은 서버가 빈도 리스트로 검증(클라 신뢰 안 함).
- **조율 노트:** 본 Phase는 코드 미편집. `apps/mobile/**` 변경은 동시 세션과 합의 후 별도 트랙으로(I-U3).

### 횡단 — INPUT-002 freeze 가드 계승 (전 Phase)
- **Task X.1** 측정·라이터·루프 코드가 레거시 프리미엄 테이블/어드민/타입을 import·query하지 않음을 정적 가드로 보증(INPUT-002 REQ-AUTO-005 계승).

---

## 4. 측정 스코어링 알고리즘 (REQ-VOCAB-A 정밀 정의)

### 4.1 입력 / 출력

- **입력:** 사용자 응답 `Array<{ token, isReal, band?, known }>` — `isReal=true`는 빈도 리스트 실단어(밴드 태깅됨), `isReal=false`는 의사단어.
- **출력:** `{ estimatedSize, estimatedBand(4밴드), estimatedLevel(CEFR), seedKnownWords: Array<{ lemma, frequencyBand(5밴드) }> }`.

### 4.2 위양성 보정 수학 (정전 계약)

```
밴드폭(width): beginner 500, basic 1000, conversation 1500, professional 3000   (BAND_WORD_COUNTS 차분)
밴드별:
  hitRate_b        = (밴드 b 실단어 중 known=yes) / (밴드 b 실단어 수)
falsePositiveRate  = (의사단어 중 known=yes) / (의사단어 수)
correctedFrac_b    = max(0, (hitRate_b - fpr) / (1 - fpr))        # fpr<1 가정, fpr→1 클램프
estimatedSize      = Σ_b (correctedFrac_b × width_b)
estimatedBand      = bandForSize(estimatedSize)  → professional 클램프 (advanced 미산출)
estimatedLevel     = getBandSeedMetadata(estimatedBand).cefrLevel
seedKnownWords     = isReal && known=yes 인 실단어 → { lemma, frequencyBand = bandForRank(rank) }  # advanced 허용
```

### 4.3 엣지/안전

- `fpr ≥ 1` 또는 의사단어 0개 → 보정 분모 0/음수: 안전 클램프(correctedFrac=hitRate 또는 0), 보수적 밴드(A-W1).
- `fpr > 0.5`(과대표기): estimatedBand 한 단계 하향(A-U4).
- 의사단어는 `seedKnownWords`에 **절대 미포함**(A-U3/P-U2).

---

## 5. 기술 스택 · 의존성 (production-stable only)

- **언어/런타임:** TypeScript(스코어러·로더·루프 = `packages/shared` 순수함수; 라이터·API = `apps/web` Next.js route).
- **DB·RLS:** Supabase. `user_vocab_profiles`·`known_words` 모두 `self_only` RLS(`auth.uid()=user_id`). user-token client 권장(Task 2.1).
- **빈도 리스트:** 투과 라이선스 rank-ordered lemma 리스트(Task 0.1 결정). 후보·라이선스는 `/moai:2-run`에서 WebFetch로 확정.
- **재사용(KEEP):** `reading-coverage.ts`(verifyCoverage), `vocab-band.ts`(BAND_WORD_COUNTS/getBandSeedMetadata/coverageDifficultyAdjustment), `band-coverage.ts`(computeBandCoverage 폴백), `generateReadingPiece`(knownLemmas 게이트).
- **모바일(계약):** Expo RN. 본 SPEC 미구현(조율 트랙).

> 버전 핀: 정확한 stable 버전·빈도 리스트 출처·라이선스는 `/moai:2-run`에서 code-builder가 WebFetch로 확정(현 시점 미핀).

---

## 6. 리스크 분석 · 대응

| # | 리스크 | 대응 |
|---|---|---|
| R1 | **빈도 리스트 라이선싱/출처** | 투과 라이선스 리스트 선호(F-U4, Task 0.1). 비투과면 명시 결정 없이 배포 금지. `/moai:2-run` WebFetch 라이선스 확인 |
| R2 | **측정 정확도 vs 길이** | Yes/No ~40실단어가 정확도-마찰 sweet spot(§1.2 대안 C). IRT/CAT(옵션 D)는 v2. 의사단어 위양성 보정으로 과대표기 통제 |
| R3 | **lemmatization 갭** | `tokenizeText`는 v1 단순 split(`reading-coverage.ts:4-7`) — 굴절형(running vs run) 미정규화. 스코어러는 이 한계를 가정해 **보수적 추정**(굴절형 미스매치 = 미지어로 흡수). 풀 lemmatizer는 비목표 |
| R4 | **히스테리시스 튜닝** | K 기본 ≥3 동방향 투표(R-W1) — 매 세션 밴드 플립 방지. K·임계는 config. 너무 크면 적응 둔감/작으면 불안정 → `/moai:2-run`에서 실측 튜닝 |
| R5 | **콜드 스타트** | known_words 비면 빈 set 함정(전부 unknown). `computeBandCoverage` 밴드-셋 폴백(R-U1). 온보딩 seed가 1차 시드, 중도이탈 시 `level_band`/`conversation` 폴백(I-W1) |
| R6 | **데이터 모델 비대칭(4밴드 vs 5밴드)** | `estimated_band`=4밴드(professional 클램프), `known_words.frequency_band`=5밴드(`advanced`). 스코어러 명시 계약(A-U2/A-U3). 혼동 시 CHECK 제약 위반 → 테스트로 강제 |
| R7 | **RLS write 경로** | user-token client 권장(self_only 자동). admin client면 every write user_id 스코프(P-U1). 잘못된 client 선택 시 RLS 거부/누수 → 테스트 |
| R8 | **모바일 동시 편집 충돌** | 모바일 온보딩 UI는 계약만(Phase 5). `apps/mobile/**` 맹목 편집 금지(I-U3), 별도 세션과 조율 |
| R9 | **부분 영속 불일치** | 프로필만 기록·known_words 누락 = 밴드-without-seed. atomic-or-recoverable + 탐지·재시도(P-W1) |
| R10 | **의사단어 누수** | 의사단어가 known_words/콘텐츠에 새면 커버리지 오염. seed/write 경로에서 isReal 필터 강제(A-U3/P-U2) |

---

## 7. @MX 태그 타깃

- **`@MX:ANCHOR` 측정 스코어러** — Yes/No 위양성 보정 + 밴드 매핑 단일 진입점(REQ-VOCAB-A-U1). `@MX:REASON` 정전 스코어링 계약(밴드·known_words 둘 다 산출).
- **`@MX:ANCHOR` 프로필/known_words 라이터** — 현재 부재 라이터 단일 경로(REQ-VOCAB-P). `@MX:REASON` RLS self_only 계약 + idempotent upsert.
- **`@MX:ANCHOR` 히스테리시스 밴드 조정** — Refine 밴드 플립 단일 함수(REQ-VOCAB-R-W1). `@MX:REASON` K연속 투표·4밴드 클램프 불변식.
- **`@MX:WARN`** — 위양성 보정 분기(fpr→1, 과대표기 하향, 분모 0) + 빈 known_words 콜드 스타트 폴백(`@MX:REASON` 필수).
- **`@MX:NOTE`** — 4밴드 vs 5밴드 비대칭(professional 클램프 vs advanced 허용) 의도, lemmatization 갭(보수적 추정) 의도, 빈도 리스트 라이선싱 결정.
- **`@MX:TODO`** — 빈도 리스트 라이선스 확정(Task 0.1), inferred-known(R-O1 선택), 모바일 온보딩 계약 결선(Phase 5 조율), TDD RED 미구현 타깃.
- **기존 KEEP 태그 유지:** `today/route.ts:108`(`@MX:ANCHOR resolveUserBand`), `:148`(`fetchPoolReadingForBand`), `:192`(`fetchSegmentsForBand`), `reading-coverage.ts:4`·`band-coverage.ts:1-9`는 확장하되 ANCHOR 강등 금지.

---

상세 인수 기준·테스트 시나리오는 `acceptance.md`를 참조한다.
