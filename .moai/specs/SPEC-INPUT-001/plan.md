# SPEC-INPUT-001 구현 계획 (plan.md)

> 근거: `research.md` §5(데이터 모델 델타), §6(레퍼런스 file:line), §7(리스크), §8(페이징+안전 제거). PRD v1.3. 방법론 = **TDD**(`.moai/config/sections/quality.yaml` `development_mode: tdd`). 각 빌드 Phase는 fixture-mode 테스트 + 서버 entitlement 게이트를 동반한다(research §8.2).
> 일정 표현은 시간 단위 대신 우선순위·의존 순서(Primary/Secondary/Final Goal)로 기술한다.

---

## 1. 페이징 개요 (빌드 Phase + 안전 제거 Stage 인터리브)

research §8.1(안전 제거 Stage A/B/C)을 §8.2(빌드 Phase 1~5)에 끼워 넣는다. 원칙: **Stage A는 가장 먼저**(이미 삭제된 잔재 커밋, 회귀 위험 낮음), **Stage B는 교체본이 생긴 뒤**(PREMIUM-001 산물의 대체 surface가 존재할 때만 제거), **Stage C는 맨 끝**(PREMIUM-001 SPEC을 Superseded 표기).

```
Stage A ─┐
         ├─ Phase 1 (데이터 모델 + 레벨 시드)
         │     └─ Stage B(1) UI 패널 제거: Roleplay/ExpressionCards/DeliveryAnalysis/Completion
         ├─ Phase 2 (리딩 트랙)
         │     └─ Stage B(2) AI 생성 산물 제거: expression-card-ai / module-ai roleplay / prompt.md
         ├─ Phase 3 (리스닝 트랙)
         ├─ Phase 4 (질문 에이전트 + 히스토리)
         │     └─ Stage B(3) shared premium 타입 deprecate→제거
         ├─ Phase 5 (세션 조립 v1)
         │     └─ Stage B(4) DB drop 마이그레이션 (premium_expression_cards / premium_articles / roleplay·delivery_analysis 컬럼)
         └─ Stage C (PREMIUM-001 status → Superseded)
```

각 Stage B 단계 사이에는 타입 컴파일·`pnpm test` 그린을 게이트로 둔다. **KEEP 목록(research §3.3)은 어느 Stage에서도 건드리지 않는다.**

---

## 2. 안전 제거 계획 (research §8.1)

### Stage A — 이미 삭제된 잔재 커밋 (Primary Goal, 선행)
작업트리에서 이미 `[D]` 상태인 항목을 스테이징·커밋한다(회귀 위험 낮음, 테스트도 함께 삭제됨).
- 모바일: `app/(tabs)/explore.tsx`, `app/collection/[key].tsx`, `app/longform/[packId].tsx`, `app/shadowing/[videoId].tsx`, `app/study/[videoId].tsx`, `app/speaker/[slug].tsx`, `components/longform/*`, `components/shorts/*`, `components/player/{AudioPlayerBar,MiniPlayer,SessionSheet,StudyPlayer}.tsx`, `components/home/SpeakerStackCard.tsx`, `contexts/{SessionSheetContext,ShortsUIContext}.tsx`
- lib: `lib/{daily-input,free-usage,session-access,saved-shorts,feed-categories}.ts`
- 테스트: `bookmark-toggle`, `daily-input`, `free-usage`, `professional-*`, `session-*`, `short-session-card-*`, `shadowing`
- 게이트: 양 앱 `pnpm test` 그린.

### Stage B — PREMIUM-001 산물 단계적 제거 (교체본 존재 후, research §3.2 순서)
1. **B(1) UI 패널** — `RoleplayPanel`(`PremiumSessionScreen.tsx:617-906`), `ExpressionCardsPanel`(`:386-526`), `DeliveryAnalysisPanel`(`:333-384`), `CompletionPanel`(`:908-958`) 제거. *Phase 1 직후* (리딩/리스닝 뷰어 교체가 시작되면).
2. **B(2) AI 생성 산물** — `expression-card-ai.ts`, `module-ai.ts`의 roleplay 생성부, `prompt.md`, `premium-expression-prompt.ts` 제거. *Phase 2 직후* (리딩 생성이 LLM 패턴을 흡수한 뒤). **단 LLM 호출 골격·anti-slop voice-rules는 레퍼런스/KEEP.**
3. **B(3) shared 타입** — `PremiumRoleplay`/`PremiumRoleplayTurn`/`PremiumExpressionCard`/`PremiumDeliveryAnalysis`/`PREMIUM_SESSION_STEPS`(`packages/shared/src/types/index.ts`) deprecate → 제거. *Phase 4 직후* (web/mobile import가 v1.3 타입으로 옮겨간 뒤; 모노레포 동시 깨짐 방지 — research §7.7).
4. **B(4) DB drop 마이그레이션** — `premium_expression_cards`, `premium_articles` drop + `premium_sessions`의 `roleplay`/`delivery_analysis` jsonb 컬럼 drop + `pronunciation_analyses` source CHECK의 `'premium-roleplay'` 제거. *Phase 5 직후* (데이터 미운영 전제 — research §2.4/§5, 안전).

### Stage C — PREMIUM-001 SPEC deprecate (Final Goal)
`.moai/specs/SPEC-PREMIUM-001/spec.md` status → `Superseded by SPEC-INPUT-001`. **PREMIUM-001 파일은 편집하지 않고 status 라인만 갱신.**

---

## 3. 빌드 Phase 분해 (research §8.2)

### Phase 1 — 데이터 모델 + 레벨 시드 (Primary Goal)
- **Task 1.1** 신규 마이그레이션 작성: `user_vocab_profiles`, `known_words`, `reading_pieces`, `channels`, `video_segments`, `asked_items`, v1.3 `sessions` (§4 마이그레이션 목록).
- **Task 1.2** shared 타입 추가: `UserVocabProfile`, `KnownWord`, `ReadingPiece`, `Channel`, `VideoSegment`, `AskedItem`, `Session`(v1.3). (premium 타입은 아직 유지 — Stage B(3)에서 제거.)
- **Task 1.3** band → 초기 known-word set 매핑 테이블 구현(빈도 밴드 어디까지 known으로 가정). onboarding band-seed 재사용(`onboarding.tsx`).
- **Task 1.4** `supabase-store.ts` `createSupabaseStore`에 `mapVocabProfileRow`/`mapKnownWordRow`/`mapAskedItemRow` 매퍼 추가(매퍼 패턴 KEEP).
- **인터리브:** Stage B(1) UI 패널 제거.
- **TDD:** vocab profile 생성·band 매핑·known-word 판정 테스트 우선(RED) → 구현(GREEN).

### Phase 2 — 리딩 트랙 (Secondary Goal)
- **Task 2.1** `ReadingPiece` 생성 라우트: 레벨 i+1 × 관심사 × 포맷 프롬프트(신규) + LLM 호출 골격 재사용(`expression-card-ai.ts:210-287` Gemini/Azure 구조화 출력, `:383-435` 폴백).
- **Task 2.2** 커버리지 자동 검증: known-word set 대조로 모르는 단어 비율 계산, 목표 2~5% 게이트(신규 도메인 로직).
- **Task 2.3** 픽션 슬롭 검수: `findPremiumCopySlop`(`premium-voice-rules.ts:38-59`) 재사용.
- **Task 2.4** 논픽션 grounding 최소: 사실 소스 주입 후 레벨 통제 문장 생성.
- **Task 2.5** 리딩 뷰어: `ArticleReader` ADAPT + 탭-글로스 센서 결선(REQ-INPUT-001-E1).
- **인터리브:** Stage B(2) AI 산물 제거.
- **TDD:** 커버리지 검증·슬롭 검수 게이트 테스트 우선.

### Phase 3 — 리스닝 트랙 (Secondary Goal)
- **Task 3.1** `Channel` 화이트리스트 시드(소수 수동 태깅 — 레벨 밴드/시각·억양/주제).
- **Task 3.2** 세그먼트 인제스트: `youtube-transcript.ts`(yt-dlp + json3/VTT) 재사용 → transcript 추출.
- **Task 3.3** 난도 스코어: 어휘 커버리지(95~98%) + wpm(transcript 타임스탬프로 계산). `key-segment-ai.ts:134-174` 스코어러 패턴 ADAPT.
- **Task 3.4** 자족성 게이트: LLM이 transcript로 "앞을 가리킴" 판정.
- **Task 3.5** `VideoSegment` 인덱스 영속(영상당 N구간).
- **Task 3.6** 세그먼트 플레이어: `YouTubePlayer.tsx`(`startSeconds`/`seekTo`) 재사용 + 자막 싱크(`premium-transcript-sync.ts`) + 탭-글로스.
- **TDD:** wpm 산출·커버리지 스코어·자족성 게이트 테스트 우선.

### Phase 4 — 하이라이트 질문 에이전트 + 히스토리 (Secondary Goal)
- **Task 4.1** user-facing 질문 라우트(신규): `requireApiUser()` Bearer 패턴 + LLM 호출 + **return-to-flow 짧은 답 전용 프롬프트(신규)**. (현행 `/api/ai-tip`·`/api/analyze` 웹 라우트 미구현 — research §6.5.)
- **Task 4.2** `AskedItem` 영속: `HighlightBottomSheet.tsx`(`onSelectionChange`/`onSave`) 진입점 + `supabase-store` 매퍼.
- **Task 4.3** 질문 히스토리 탭: 저장된 `AskedItem` 재열람 UI.
- **Task 4.4** 월 캡 + 모델 티어링: 잔여 횟수 긍정형 표시, 캡 소진 시 graceful 거절, 평소 경량/필요시 상위 모델.
- **인터리브:** Stage B(3) shared premium 타입 deprecate→제거.
- **TDD:** 캡 카운팅·소진 거절·AskedItem 영속 테스트 우선.

### Phase 5 — 세션 조립 v1 (Final Goal)
- **Task 5.1** 세션 조립: 읽기 1 + 세그먼트 N 묶기. `premium-curation.ts`(`scorePremiumSessionForProfile`) 스코어링 재사용.
- **Task 5.2** `/api/.../today` 응답형 교체: 단일 세션 → `{reading_piece, segments[]}`. `repository.ts` 패턴 KEEP, 쿼리 대상 교체.
- **Task 5.3** 홈 화면 ADAPT: `app/(tabs)/index.tsx` 오늘 세션 카드 교체.
- **Task 5.4** 서버 entitlement 게이트 결선: `entitlement.ts`(`resolvePremiumEntitlement`) 재사용, 미보유 시 402.
- **Task 5.5** 신규 테이블 RLS: 사용자 소유(본인-전용) vs 콘텐츠(서버 전용 public SELECT 없음).
- **인터리브:** Stage B(4) DB drop 마이그레이션 → 이후 Stage C.
- **TDD:** 조립 응답형·entitlement 402·RLS 접근 거부 테스트 우선.

---

## 4. 데이터 모델 마이그레이션 목록 (research §5)

### 신규 테이블 (v1.3)
| 테이블 | 핵심 컬럼 | RLS | 기존 대응 |
|---|---|---|---|
| `user_vocab_profiles` | user_id, estimated_band, estimated_level, updated_history(jsonb) | 본인-전용 | `users.level_band`만 존재 — known-word set 신규 |
| `known_words` | user_id, lemma, frequency_band, source(tap/seed), last_seen | 본인-전용 | 전무 (행 폭발 대비 별도 테이블 — research 오픈질문 권고) |
| `reading_pieces` | level, format, topic, body, coverage_pct, validation_status, source_facts(jsonb) | 서버 전용 | `premium_articles` REMOVE 대체 |
| `channels` | name, level_band, visual_accent_tags, topics, active | 서버 전용 | `speakers`/`video_speakers` 유사(스피커≠채널) — 신규 |
| `video_segments` | parent_video_id, start_time, end_time, transcript(jsonb), wpm, band_coverage(jsonb), topic_tags, self_contained, channel_id | 서버 전용 | `premium_sessions.{segment_start_time,segment_end_time,transcript}` 부분 유사 — 영상당 N구간으로 확장 |
| `asked_items` | user_id, source_type, source_ref(위치), highlight_text, question, answer, created_at | 본인-전용 | `highlights` 가장 가까움(질문/응답 필드 신규) |
| `sessions` (v1.3) | user_id, date, reading_piece_id, segment_ids(array), assembly_meta(jsonb) | 본인-전용/서버 | `premium_sessions` 6-스텝 jsonb 컬럼 죽음 — reading+segments 조립 구조 |

### PREMIUM-001 drop 마이그레이션 (Stage B(4))
- DROP TABLE `premium_expression_cards`, `premium_articles`.
- ALTER `premium_sessions` DROP COLUMN `roleplay`, `delivery_analysis`.
- ALTER `pronunciation_analyses` source CHECK: `'premium-roleplay'` 제거.
- 전제: 데이터 미운영(fixture-only/internal, PREMIUM verification.md 기준) → drop 안전(research §2.4, §5).

### 유지(슬라이스 무관)
`users`, `pronunciation_analyses`, `saved_sentences`, `card_comments`, `push_tokens`, recordings 버킷, `highlights`(AskedItem 진입점으로 KEEP/ADAPT).

---

## 5. 기술 스택 · 의존성 (production-stable only)

> research §6.1/§7.8 확인: 본 저장소는 **Anthropic 미사용**. LLM은 Gemini + Azure OpenAI 2종.

- **LLM 생성·검증·질문 에이전트:** Google Generative AI(`@google/generative-ai`) + Azure OpenAI REST 폴백. 티어링(D1): 리딩·리스닝 생성 = `gemini-2.5-pro`(`expression-card-ai.ts:196-202` Flash 거부 계승), 질문 에이전트 짧은 답 전용 Flash-gate = `gemini-2.5-flash`. 환경변수 `GEMINI_API_KEY`/`AZURE_OPENAI_*`.
- **DB·인증·RLS:** Supabase (PostgreSQL + RLS). 사용자 소유 RLS + 콘텐츠 서버 전용 RLS(public SELECT lockdown 패턴 `20260614000300`).
- **세그먼트 플레이어:** `react-native-youtube-iframe`(`YouTubePlayer.tsx`). 임베드로 호스팅·저작권 회피.
- **트랜스크립트 인제스트:** `yt-dlp` + `youtube-transcript-api` 폴백(`youtube-transcript.ts`, json3/VTT 파싱).
- **모바일:** Expo / React Native + MMKV(세션 진행 `premium-session-progress.ts` ADAPT) + Bearer auth(`premium-api.ts`).
- **테스트:** Jest fixture-mode 패턴(`premium-api.ts:69-99`, `premium-api-fixture-mode.test.ts`).
- **티어링 확정(D1):** Gemini 단일 제공자(Flash↔Pro) + Azure 폴백. 질문 에이전트 짧은 답에 한해 Flash-gate 신설, 나머지 생성은 Pro 유지.

> 버전 핀: 정확한 stable 버전은 `/moai:2-run` 단계에서 code-builder가 확정(research/PRD에 핀 미지정).

---

## 6. 리스크 분석 · 대응 (research §7)

| # | 리스크 | 대응 |
|---|---|---|
| R1 | YouTube 세그먼트 임베드 + 저작권 (PRD §6.3/§12) | 임베드로 호스팅 회피. 임의 start/end만 재생 시 ToS·플레이어 제약 확인. 영화·애니는 임베드 불가(별도 칸, Out) |
| R2 | ASR/자막 품질 상속 (PRD §12) | 사람 자막 우선(`youtube-transcript.ts`). ASR 폴백 시 글로스 품질 경고/강등(REQ-INPUT-003-U3) |
| R3 | LLM 슬롭/grounding (PRD §6.2/§12) | 픽션: `findPremiumCopySlop` 재사용. 논픽션: 사실 grounding 필수(REQ-INPUT-002-W2) |
| R4 | 에이전트 비용 (PRD §6.6) | 월 100회 소프트 캡(D3) + Gemini Flash-gate(D1). 소진 시 경량 모델 강등·안내(하드 차단 아님) |
| R5 | client-only vs server entitlement 갭 (PRD §12) | 서버 게이트(`entitlement.ts`) + RLS 강제. 모바일 fixture-mode dev-only 격리 재확인(`premium-api.ts:88-93`) |
| R6 | RLS 누락 | 신규 콘텐츠 테이블 서버 전용, 사용자 소유 본인-전용 RLS(REQ-INPUT-005-U4) |
| R7 | 모노레포 shared-type 커플링 | premium 타입 제거 단계적(deprecate→교체→삭제), Stage B(3)에서만 (research §7.7) |
| R8 | LLM 제공자 정렬 | **확정(D1):** Gemini 단일 제공자 Flash↔Pro + Azure 폴백. Flash-gate는 질문 에이전트 짧은 답 전용 |
| R9 | auth 일관성 | user-facing 질문 라우트는 `requireApiUser()` Bearer 패턴 통일(research §7.9) |

---

## 7. @MX 태그 타깃

- **`@MX:ANCHOR createSupabaseStore`** — fan_in≥3 (research §6.8). v1.3 매퍼(`mapVocabProfileRow`/`mapAskedItemRow` 등) 추가 시 invariant contract 유지.
- **`@MX:ANCHOR resolvePremiumEntitlement`** — 모든 세션 콘텐츠 게이트의 단일 진입점(public API 경계, REQ-INPUT-005-U1).
- **`@MX:ANCHOR`** 신규 public 경계: `ReadingPiece` 생성 라우트, 세그먼트 인제스트·스코어러, 질문 에이전트 라우트(user-facing).
- **`@MX:WARN`** — 커버리지 검증/난도 스코어 산출(분기 복잡도 ≥15 가능) + LLM 폴백 경로(`@MX:REASON` 필수).
- **`@MX:NOTE`** — band→known-word 시드 매핑(비자명 도메인 규칙), return-to-flow 짧은 답 프롬프트 의도.
- **`@MX:TODO`** — TDD RED 단계의 미구현 테스트 타깃(GREEN에서 해소).

---

상세 인수 기준·테스트 시나리오는 `acceptance.md`를 참조한다.
