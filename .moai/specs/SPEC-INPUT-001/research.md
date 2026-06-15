# SPEC-INPUT-001 Research — v1.3 Comprehensible-Input 두 트랙 엔진 (수직 슬라이스)

> Plan-phase 연구 산출물. READ-ONLY 코드 분석 기반. 모든 주장은 가능한 한 `file:line`을 인용한다.
> 근거 문서: PRD v1.3 (`/Users/sooyeon/Downloads/inputeng_prd_v1.3.md`), 현행 브랜치 `codex/premium-migration`.
> 이 SPEC(SPEC-INPUT-001)은 **SPEC-PREMIUM-001을 대체(supersede)**한다. PREMIUM-001은 deprecated로 표기한다.

---

## 1. Executive Summary

### 1.1 무엇이 바뀌나
현행 `codex/premium-migration` 브랜치는 **SPEC-PREMIUM-001의 단일 큐레이션 딥다이브 모델**(월 ₩25,900, 한 영상 → 아티클 → 내용캐치 → 분석듣기 → 핵심표현 카드 → 롤플레잉 → 완료)을 거의 완성 단계까지 구현했다. 6-스텝 세션 모델이 타입(`PREMIUM_SESSION_STEPS`, `packages/shared/src/types/index.ts:230-237`), DB(`supabase/migrations/20260614000100_add_premium_sessions.sql`), 모바일 화면(`apps/mobile/src/components/premium/PremiumSessionScreen.tsx`, 1653줄), 웹 생성 파이프라인(`apps/web/src/lib/premium/*`), 어드민 UI(`apps/web/src/app/admin/premium/page.tsx`, 2112줄)에 걸쳐 있다.

PRD v1.3는 이 모델을 **명시적으로 강등**한다(PRD §0, §6.5): "딥다이브 카드·회상 퀴즈는 v1.3 제외", "롤플레잉/표현 딥다이브는 옵션 능동 레이어로 강등 → v1.3에서는 질문 히스토리 탭 하나로 최소화". 핵심 가치가 **"에디토리얼 큐레이션 안목" → "수준 측정·매칭 엔진"**으로 이동한다(PRD §0 v1.2 항목).

### 1.2 핵심 결론 (헤드라인)

- **쳐낼 것(REMOVE):** 롤플레잉 엔진(`RoleplayPanel` + `PremiumRoleplay` 타입 + roleplay 생성 AI), 표현 딥다이브 카드(`ExpressionCardsPanel`/`PremiumExpressionCard` + `premium_expression_cards` 테이블 + `expression-card-ai.ts` + `prompt.md`), 6-스텝 단일 큐레이션 세션 모델 자체(`PREMIUM_SESSION_STEPS`). 이미 git에서 삭제된(`D`) 더 오래된 잔재(쇼츠/롱폼/shadowing/study, `daily-input.ts`, `free-usage.ts`, `session-access.ts`, `saved-shorts.ts`, `feed-categories.ts`)는 작업트리 삭제 상태이므로 **삭제 확정(스테이징만 하면 됨)**.
- **재사용(ADAPT/KEEP):** 두 트랙 엔진의 거의 모든 인프라가 이미 있다 — YouTube iframe 세그먼트 플레이어(`YouTubePlayer.tsx`, start/seek 지원), 트랜스크립트 100ms 싱크(`premium-transcript-sync.ts`), LLM 호출+JSON 스키마 강제 패턴(Gemini + Azure, `expression-card-ai.ts`/`module-ai.ts`/`key-segment-ai.ts`), yt-dlp 트랜스크립트 인제스트(`youtube-transcript.ts`), 서버사이드 entitlement(`entitlement.ts` + `/api/premium/*`), 하이라이트 텍스트 선택+영속(`HighlightBottomSheet.tsx` + `highlights` 테이블), 온보딩 레벨 시드(`onboarding.tsx`), Supabase repository/service 패턴, fixture-mode 테스트 패턴(`premium-api.ts`).
- **새로 만들 것(BUILD):** v1.3 데이터 모델 전체가 신규 — `UserVocabProfile`, `ReadingPiece`, `VideoSegment`, `Channel(whitelist)`, `AskedItem`, v1.3 `Session`. DB에 해당 테이블/컬럼 **전무**(grep 확인: `video_segment|reading_piece|asked_item|channel_whitelist|known_word|vocab_profile` 모두 미발견). 리딩 온디맨드 생성 + 커버리지 검증, 세그먼트 인덱스, 탭-글로스 런타임 센서, 하이라이트 질문 에이전트(모델 티어링+월 캡)도 신규 비즈니스 로직.

### 1.3 수직 슬라이스 범위 (결정됨)
- **In:** [리딩 생성 1편] + [리스닝 세그먼트 재생] + [탭 글로스] + [하이라이트 질문 에이전트 + 질문 히스토리] + 최소 레벨 시드.
- **Out (후속 SPEC, 시드 호환):** 풀 온보딩 어휘 진단(CAT+pseudoword), 사전/사후 측정+환불, 가격(99k/66k)+친구코드, 개인 known-word set 고도화, 세션 조립 고도화.

---

## 2. 현행 premium-migration 인벤토리

### 2.1 모바일 (apps/mobile)

| 파일 | 줄수 | 역할 | 가정 모델 | v1.3 판정 |
|---|---|---|---|---|
| `app/premium/[sessionId].tsx` | 115 | 세션 라우트, entitlement 가드→`/paywall`, `PremiumSessionScreen` 렌더 | 단일 큐레이션 | ADAPT (라우트 골격 유지, 화면 교체) |
| `src/components/premium/PremiumSessionScreen.tsx` | 1653 | 6-스텝 세션 화면 전체 | 단일 큐레이션 | 부분 REMOVE / 부분 ADAPT (아래 §3) |
| `src/lib/premium-api.ts` | 174 | `/api/premium/today`·`/sessions/{id}` 클라이언트, fixture-mode, auth 헤더 | 단일 큐레이션 응답 | ADAPT (엔드포인트·응답형 교체, fixture/auth 패턴 KEEP) |
| `src/lib/premium-completion.ts` | 64 | expression_cards → saved_sentences/playbook 변환·영속 | expression cards | REMOVE (표현 카드 의존) |
| `src/lib/premium-interest-clusters.ts` | 42 | situations/genres → source types 추론 | 관심사 매칭 | KEEP (관심사→소스 매핑은 v1.3 리스닝 쿼리 시드로 유효) |
| `src/lib/premium-session-progress.ts` | 100 | MMKV 세션 진행 상태(lastStep 등) | 6-스텝 | ADAPT (스텝 enum 교체) |
| `src/lib/premium-transcript-sync.ts` | 23 | `findPremiumActiveTranscriptLine`, 100ms 싱크 상수 | 트랜스크립트 싱크 | KEEP (세그먼트 재생/탭글로스에 그대로 재사용) |
| `src/fixtures/premium-session.ts` | 197 | Jonny Kim 골든 세션 fixture | 단일 큐레이션 | REMOVE/REPLACE (v1.3 fixture로 교체) |
| `src/components/player/YouTubePlayer.tsx` | ~103 | `react-native-youtube-iframe` 래퍼, `startSeconds`/`seekTo`/`getCurrentTime` | 세그먼트 재생 | **KEEP (핵심 재사용)** |
| `src/components/study/HighlightBottomSheet.tsx` | ~204 | 텍스트 선택(`onSelectionChange`)+노트 저장 시트 | 하이라이트 | **KEEP/ADAPT (하이라이트 질문 진입점)** |
| `app/onboarding.tsx` | (수정됨) | 레벨/관심사/상황/장르 수집 → `updateLearningProfile` | 학습 프로필 | **KEEP (최소 레벨 시드)** |
| `app/(tabs)/index.tsx` | (대폭 수정) | 홈, `fetchTodayPremiumSession`로 오늘 세션 카드 | 단일 큐레이션 홈 | ADAPT (세션 조립 v1로 교체) |
| `src/lib/ai-api.ts` | (수정됨) | `fetchAiTip`(`/api/ai-tip`), `analyzeSentence`(`/api/analyze`), 발음분석 폴링 | 문장 단위 AI | ADAPT (탭글로스/질문 에이전트의 참조 패턴) |

> 주의: PremiumSessionScreen 내 일부 export(`VideoPanel`, `TranscriptPanel`, `ArticleReader`)는 v1.3 리딩 뷰어/세그먼트 플레이어로 ADAPT 가능. 반대로 `RoleplayPanel`(617-906), `ExpressionCardView`/`ExpressionCardsPanel`(386-526), `DeliveryAnalysisPanel`(333-384), `CompletionPanel`(908-958)는 v1.3에서 죽는다.

### 2.2 웹 (apps/web)

| 파일 | 줄수 | 역할 | 가정 모델 | v1.3 판정 |
|---|---|---|---|---|
| `src/lib/premium/entitlement.ts` | 56 | `resolvePremiumEntitlement(user)` — `users.plan` 조회 + 7일 trial 윈도우 | 서버 entitlement | **KEEP (gating 패턴 재사용)** |
| `src/lib/premium/revenue-cat-entitlement.ts` | 110 | RevenueCat → `users.plan` 동기화 | 구독 | KEEP (가격은 후속이나 패턴 유지) |
| `src/app/api/premium/entitlement/sync/route.ts` | 40 | Bearer + `requireApiUser()` | 서버 entitlement | KEEP |
| `src/app/api/premium/today/route.ts` | 40 | 오늘 세션, entitlement 없으면 402 | 단일 큐레이션 | ADAPT (세션 조립 v1 응답) |
| `src/app/api/premium/sessions/[sessionId]/route.ts` | 68 | 특정 세션, status=published RLS | 단일 큐레이션 | ADAPT |
| `src/lib/premium/repository.ts` | 201 | `fetchPublishedPremiumSessionById`, `fetchTodayPremiumSessionForUser`, 하이드레이션 | premium_sessions | ADAPT (repository 패턴 KEEP, 쿼리 대상 교체) |
| `src/lib/premium/session-schema.ts` | 500 | Zod 스키마 + `parseAiExpressionCard` 등 | 단일 큐레이션 | 부분 REMOVE (expression/roleplay 스키마) / 패턴 KEEP |
| `src/lib/premium/expression-card-ai.ts` | 529 | Gemini/Azure로 표현 카드 생성, responseSchema 강제, 폴백 stub | 표현 카드 | REMOVE (산물) / **LLM 호출 패턴 KEEP (레퍼런스)** |
| `src/lib/premium/module-ai.ts` | 481 | article+roleplay 생성, anti-slop voice rules | 단일 큐레이션 | 부분 REMOVE(roleplay) / **anti-slop+생성 패턴 KEEP** |
| `src/lib/premium/key-segment-ai.ts` | 321 | 1개 핵심 구간 선정(스코어링) | 단일 큐레이션 | **ADAPT → 세그먼트 난도 스코어링의 강력한 레퍼런스** |
| `src/lib/premium/youtube-transcript.ts` | 365 | yt-dlp + youtube-transcript-api 폴백, json3/VTT 파싱 | 트랜스크립트 인제스트 | **KEEP (리스닝 오프라인 인제스트 핵심)** |
| `src/lib/premium/pipeline.ts` | 346 | 드래프트 조립 오케스트레이션 | 단일 큐레이션 | ADAPT (리딩/세그먼트 파이프라인으로 재구성) |
| `src/lib/premium/curation-scoring.test.ts` | - | (스코어링 테스트) | - | 참조 |
| `src/lib/premium/admin-*.ts` (draft-review, transcript-workspace, publish-status, design-tokens) | 128~418 | 어드민 운영 도구 | 단일 큐레이션 | 대부분 REMOVE/ADAPT (어드민은 슬라이스 외 but 화이트리스트 운영에 일부 ADAPT) |
| `src/lib/premium/push-notifications.ts` | 117 | 일일 푸시 | - | KEEP |
| `src/app/admin/premium/page.tsx` | 2112 | 어드민 파이프라인 UI | 단일 큐레이션 | 대부분 REMOVE/재작성 (슬라이스 외) |
| `src/app/api/admin/premium/{expression-card,pipeline/draft,pipeline/segment,sessions/draft,sessions/[id]/publish,transcript}/route.ts` | - | 어드민 생성 라우트 | 단일 큐레이션 | 부분 REMOVE / 트랜스크립트·세그먼트 ADAPT |
| `src/lib/premium/shared.ts` 부재; voice rules는 shared 패키지 | - | - | - | - |

### 2.3 shared 패키지 (packages/shared)

| 파일 | 역할 | v1.3 판정 |
|---|---|---|
| `src/lib/premium-curation.ts` | `scorePremiumSessionForProfile`, `selectDailyPremiumSession` (난도/관심사 스코어링) | ADAPT (세션 조립 v1 스코어링 로직 재사용 가능) |
| `src/lib/premium-expression-prompt.ts` | `buildExpressionCardPrompt` (storytelling-v2 표현 카드 프롬프트) | REMOVE (표현 카드 산물) |
| `src/lib/premium-voice-rules.ts` | `PREMIUM_COPY_BANNED_TERMS`, `..ABSTRACT_VERBS`(켜지/피어나/물들), `buildPremiumAntiSlopVoiceRules`, `findPremiumCopySlop` | **KEEP (리딩 픽션 슬롭 검수에 직접 재사용 — PRD §6.2)** |
| `src/lib/supabase-store.ts` | `createSupabaseStore` 팩토리, row 매퍼 (saved_sentence/session/highlight/ai_note) | **KEEP (DB 추상화 패턴, AskedItem 매퍼 추가)** |
| `src/types/index.ts` | 전 타입 정의 (premium 타입 포함) | 부분 REMOVE (premium 타입) / 신규 v1.3 타입 추가 |

### 2.4 DB 마이그레이션 (supabase/migrations)

premium 전용 3종 (모두 untracked = 신규):
- `20260614000100_add_premium_sessions.sql`: `premium_sessions`, `premium_expression_cards`, `premium_articles` 생성. `pronunciation_analyses`에 `premium_session_id` 추가, source CHECK에 `'premium-roleplay'` 추가. RLS enabled, public SELECT 없음.
- `20260614000200_add_premium_saved_sentence_metadata.sql`: `saved_sentences`에 `premium_session_id`, `session_title` 추가.
- `20260614000300_lock_premium_rls.sql`: premium 3테이블 public SELECT 정책 drop (서버 전용 게이트).

판정: `premium_expression_cards`(표현 카드), `premium_articles`(아티클), `premium_sessions.roleplay`/`delivery_analysis` jsonb 컬럼은 v1.3에서 죽는다. v1.3는 **신규 마이그레이션**으로 `user_vocab_profiles`, `reading_pieces`, `video_segments`, `channels`, `asked_items`, v1.3 `sessions`(또는 기존 확장)를 추가해야 한다. PREMIUM-001 테이블 drop은 데이터가 비어 있으면(아직 운영 전) 안전 — verification.md상 fixture-only/internal 단계.

### 2.5 SPEC-PREMIUM-001 문서 + prompt.md
- `.moai/specs/SPEC-PREMIUM-001/{spec.md,plan.md,verification.md,research.md,acceptance.md}` 존재. spec.md status `Planned`, Phase 0~4 로드맵, D1~D7 결정. 6-스텝 세션 모델, 4-단계 롤플레잉(D4), 표현 카드 anchor/support가 핵심. → **본 SPEC이 supersede, status를 Deprecated/Superseded로 변경 권고.**
- `prompt.md` (121줄): storytelling-v2 표현 카드 생성 프롬프트. 켜지다/피어나다 금지 등 anti-slop 규칙 포함. → 표현 카드와 함께 REMOVE 대상이나, **anti-slop 규칙 자체는 `premium-voice-rules.ts`로 이미 코드화되어 리딩 슬롭 검수로 KEEP**.

---

## 3. 쳐낼 것 vs 재사용 (KEEP / ADAPT / REMOVE)

> `[D]` = git 작업트리에서 이미 삭제됨(staging만 남음). `[U]` = untracked 신규. `[M]` = 수정됨/현존.

### 3.1 이미 삭제된 더 오래된 잔재 (삭제 확정 — staging 필요)

| 코드 단위 | git | 판정 | 사유 (PRD v1.3) |
|---|---|---|---|
| `app/(tabs)/explore.tsx`, `app/collection/[key].tsx` | [D] | REMOVE 확정 | 쇼츠/탐색 피드 — CI 볼륨 모델과 무관 |
| `app/longform/[packId].tsx`, `components/longform/*` | [D] | REMOVE 확정 | 롱폼 팩 — v1.3 리딩=생성, 리스닝=세그먼트로 대체 |
| `app/shadowing/[videoId].tsx`, `__tests__/shadowing.test.tsx` | [D] | REMOVE 확정 | 쉐도잉 — explicit study, CI 아님 |
| `app/study/[videoId].tsx`, `app/speaker/[slug].tsx` | [D] | REMOVE 확정 | 구 학습/스피커 화면 |
| `components/shorts/*`, `components/player/{AudioPlayerBar,MiniPlayer,SessionSheet,StudyPlayer}.tsx` | [D] | REMOVE 확정 | 쇼츠/오디오 플레이어 — 세그먼트 임베드로 대체 |
| `components/home/SpeakerStackCard.tsx` | [D] | REMOVE 확정 | 스피커 중심 홈 |
| `lib/{daily-input,free-usage,session-access,saved-shorts,feed-categories}.ts` | [D] | REMOVE 확정 | 무료 사용량 제한·쇼츠·피드 카테고리 — v1.3 게이팅/모델 상이 |
| `contexts/{SessionSheetContext,ShortsUIContext}.tsx` | [D] | REMOVE 확정 | 쇼츠 UI 상태 |
| 대응 테스트들(`bookmark-toggle`, `daily-input`, `free-usage`, `professional-*`, `session-*`, `short-session-card-*`) | [D] | REMOVE 확정 | 죽은 surface 테스트 |
| web `admin/components/{SessionCreator,SentenceListEditor,TransformationExerciseEditor,VideoListModal,...}.tsx` | [D] | REMOVE 확정 | 구 어드민 — premium 파이프라인이 대체 |
| web `api/admin/{autofill-*,generate-*}` 테스트 + `retiredAdminRoute()`화 | [M]/[D] | REMOVE 확정 | 레거시 생성 라우트, 이미 retire 처리 |

> 이 그룹은 **현 브랜치 작업의 결과물**이며 v1.3와도 정렬된다. 안전 제거: 작업트리 삭제를 그대로 커밋하면 됨. 테스트는 이미 함께 삭제됨.

### 3.2 PREMIUM-001 산물 중 v1.3가 죽이는 것 (untracked → 만들지 말거나 제거)

| 코드 단위 | git | 판정 | 사유 (PRD v1.3) |
|---|---|---|---|
| `RoleplayPanel` (PremiumSessionScreen.tsx:617-906), `RoleplayExpressionCues`, `getRoleplayTargetExpressionCards` | [U] | REMOVE | 롤플레잉 = v1.3 Out (§13, §6.5). 자유 롤플레이는 후속 |
| `PremiumRoleplay`, `PremiumRoleplayTurn` 타입 (types/index.ts:322-342) | [U] | REMOVE | 롤플레잉 데이터 모델 죽음 |
| `module-ai.ts` roleplay 생성 부분 | [U] | REMOVE | roleplay 생성 불요 |
| `ExpressionCardView`/`ExpressionCardsPanel` (386-526) | [U] | REMOVE | 표현 딥다이브 카드 = v1.3 Out (§6.5, §13) |
| `PremiumExpressionCard`/`PremiumExpression*` 타입 (303-320 등) | [U] | REMOVE | 카드 데이터 모델 죽음 (AskedItem이 후속 시드) |
| `premium_expression_cards` 테이블 | [U] | REMOVE (drop 마이그레이션) | 위와 동일 |
| `expression-card-ai.ts`, `premium-expression-prompt.ts`, `prompt.md` | [U] | REMOVE | 표현 카드 생성 산물 |
| `premium-completion.ts` (모바일) | [U] | REMOVE | 카드→saved/playbook 변환 의존 |
| `DeliveryAnalysisPanel` (333-384), `PremiumDeliveryAnalysis` 타입, `delivery_analysis` 컬럼 | [U] | REMOVE | "분석듣기" 스텝 죽음 (탭글로스+질문 에이전트로 대체) |
| `CompletionPanel` (908-958) | [U] | REMOVE | 6-스텝 완료 화면 죽음 |
| `PREMIUM_SESSION_STEPS` 6-스텝 enum (types:230-237) | [U] | REMOVE/REPLACE | 단일 큐레이션 스텝 모델 자체가 죽음 |
| `premium_articles` 테이블 + `PremiumArticle` 타입 | [U] | ADAPT→REMOVE | 아티클은 "큐레이션된 1편"이 아니라 v1.3 **생성된 ReadingPiece**로 교체 |
| fixture `premium-session.ts` (Jonny Kim) | [U] | REPLACE | v1.3 슬라이스 fixture로 교체 |

### 3.3 재사용 (KEEP / ADAPT)

| 코드 단위 | git | 판정 | v1.3 용도 |
|---|---|---|---|
| `YouTubePlayer.tsx` (`startSeconds`, `seekTo`, `getCurrentTime`) | [U?]* | **KEEP** | 리스닝 세그먼트 임베드 플레이어 (PRD §6.3 임베드로 호스팅/저작권 회피) |
| `premium-transcript-sync.ts` (100ms 싱크, active line) | [U] | **KEEP** | 세그먼트 자막 싱크 + 탭글로스 위치 계산 |
| `youtube-transcript.ts` (yt-dlp+API, json3/VTT) | [U] | **KEEP** | 리스닝 오프라인 인제스트 (PRD §6.3, §9) |
| `key-segment-ai.ts` (구간 스코어링) | [U] | **ADAPT** | 세그먼트 난도 점수(어휘 커버리지+wpm) 스코어러의 레퍼런스 |
| `expression-card-ai.ts`/`module-ai.ts` LLM 호출 골격 (Gemini responseSchema + Azure json_schema strict + 폴백) | [U] | **KEEP (패턴)** | 리딩 생성·커버리지 검증·질문 에이전트 LLM 호출의 레퍼런스 |
| `premium-voice-rules.ts` (anti-slop) | [U] | **KEEP** | 리딩 픽션 슬롭 검수 (PRD §6.2 copy_system 연장) |
| `entitlement.ts` + `/api/premium/*` (서버 entitlement, 402) | [U] | **KEEP** | 서버사이드 게이팅 (PRD §12 client-only 갭 해소) |
| `repository.ts` / `supabase-store.ts` (repo/service + row 매퍼) | [U]/[M] | **KEEP (패턴)** | ReadingPiece/VideoSegment/AskedItem repository |
| `HighlightBottomSheet.tsx` + `highlights` 테이블 + `Highlight`/`AppHighlight` 타입 | [U]/기존 | **KEEP/ADAPT** | 하이라이트 질문 에이전트 진입점 + AskedItem 위치 저장 |
| `onboarding.tsx` + `users.{level_band,focus_tags,preferred_*}` | [M]/기존 | **KEEP** | 최소 레벨 시드 (band-seed) |
| `premium-interest-clusters.ts` | [U] | **KEEP** | 관심사→리스닝 소스 타입 매핑 |
| `premium-api.ts` fixture-mode + auth 헤더 패턴 | [U] | **KEEP (패턴)** | v1.3 API 클라이언트 + 테스트 |
| `premium-session-progress.ts` (MMKV 진행) | [U] | **ADAPT** | v1.3 세션 진행 상태 |
| `pronunciation/{repository,service}.ts` + `/api/pronunciation/analyses` | [M] | KEEP | 슬라이스 외(발음)이나 비동기 job 폴링 패턴 참조 |

> *`YouTubePlayer.tsx`는 디렉터리상 `components/player/`에 있으나 `git status`에 [D]로 안 잡힘 → 현존(premium 화면이 import). 정확한 경로는 `apps/mobile/src/components/player/YouTubePlayer.tsx` (탐색 보고 기준 ~103줄). 구현 시 경로 재확인 필요.

---

## 4. v1.3 수직 슬라이스 갭 분석 (재사용 vs 신규)

### 4.1 리딩 트랙 — 온디맨드 생성 1편
- **재사용:** LLM 호출 + 구조화 출력 강제 패턴(`apps/web/src/lib/premium/expression-card-ai.ts:265-287` Gemini `responseSchema`, `:210-263` Azure `json_schema strict`, 폴백 stub `:383-435`). anti-slop 슬롭 검수(`packages/shared/src/lib/premium-voice-rules.ts:38-59` `findPremiumCopySlop`, 켜지/피어나 등). 생성 프롬프트 빌더 패턴(`packages/shared/src/lib/premium-expression-prompt.ts`).
- **신규:** (a) ReadingPiece 생성 프롬프트(레벨 i+1×관심사×포맷, PRD §6.2), (b) **커버리지 자동 검증**(모르는 단어 2~5%, PRD §6.2/§3 — known-word set과 텍스트 대조 계산 로직), (c) **논픽션 grounding**(사실 소스 끌어와 위에 레벨 통제 문장 생성, PRD §6.2/§12), (d) Simple English Wikipedia authentic seam(선택). LLM 제공자 현행은 Gemini+Azure(Anthropic 아님) — v1.3 모델 티어링 정책과 충돌 없는지 결정 필요.
- **갭 크기:** 인프라 70% 재사용, 도메인 로직(커버리지·grounding·레벨 프롬프트) 신규.

### 4.2 리스닝 트랙 — 유튜브 세그먼트 인덱스 + 임베드 플레이어
- **재사용:** 임베드 플레이어 `YouTubePlayer.tsx`(`startSeconds`, `seekTo`, `getCurrentTime`), 트랜스크립트 인제스트 `youtube-transcript.ts`(yt-dlp + json3/VTT, `:181-244`, `:288-309`), 트랜스크립트 싱크 `premium-transcript-sync.ts`(100ms), 구간 스코어링 레퍼런스 `key-segment-ai.ts`(`practicalUseScore` 등 1-5 스코어 패턴, `:134-174`).
- **신규:** (a) **VideoSegment 인덱스 데이터 모델**(parent_video_id, start/end, transcript, wpm, band coverage, topic tags, self_contained, channel_id — DB 전무), (b) **난도 스코어 = 어휘 커버리지 + wpm** 산출(PRD §6.3 — wpm 계산은 transcript 타임스탬프로 가능, 커버리지는 known-word set 대조), (c) **Channel 화이트리스트** 데이터+태깅(레벨 밴드/시각·억양 태그/주제, PRD §6.3/§9 — 일회성 사람 태깅), (d) **자족성 게이트**(LLM이 transcript로 "앞을 가리키는지" 판정, PRD §6.3), (e) 큰 코헤런트 덩어리 세그먼트 컷팅(2~3개 장면/토픽). 플레이어는 `segment_start_time`/`segment_end_time` 패턴 이미 있음(types:361-362) → VideoSegment에 매핑.
- **갭 크기:** 플레이어/인제스트 인프라 재사용, 인덱스 모델·스코어링·화이트리스트는 신규.

### 4.3 수준 모델 — band-seed + 탭-투-글로스 런타임 센서
- **재사용:** band seed = `onboarding.tsx`(`level_band` 4밴드 beginner/basic/conversation/professional + 관심사) + `users.level_band` 컬럼(`migrations/20260418010000:2,14-17`). 탭 인터랙션 UI 기반 = TranscriptPanel 탭-투-seek(`PremiumSessionScreen.tsx:300`) 및 HighlightBottomSheet 선택.
- **신규:** (a) **UserVocabProfile** 데이터 모델(band 추정 + known-word set + 갱신 이력 — DB 전무, grep `known_word|vocab_profile` 미발견), (b) **탭-투-글로스 런타임 센서**(탭할 때마다 단어 모름 신호 → known-word set 갱신, PRD §6.1), (c) **자가보정 루프**(콘텐츠 내 모르는 단어 비율 목표 2~5%, 10% 초과→난도↓, 0%→난도↑). 현행 band seed는 4밴드 정수 추정뿐 → 개인 단어 집합으로 확장(PRD §6.1 "day 1부터 개인 단어 집합으로 설계, 초기값은 밴드 추정").
- **갭 크기:** 시드 입력 UI는 재사용, vocab profile 자료구조+센서 루프는 신규.

### 4.4 하이라이트 질문 에이전트 + 질문 히스토리
- **재사용:** 하이라이트/텍스트 선택 = `HighlightBottomSheet.tsx`(`onSelectionChange`, selection {start,end}, `:33-43,99`) + `highlights` 테이블 + `Highlight`/`AppHighlight` 타입(types:18-25, 561-570). AI 호출 패턴 = `ai-api.ts` `analyzeSentence`/`fetchAiTip`(문장 단위, `:316-358`) + 발음분석 비동기 job 폴링(`:508-631`). LLM 호출+스키마 강제 = expression-card-ai 패턴.
- **신규:** (a) **하이라이트 → instant question(뜻·뉘앙스·용법) → short answer → return to flow** 에이전트 라우트(현행 `/api/ai-tip`·`/api/analyze`는 모바일에서 호출되나 웹 라우트 미구현 — 탐색 확인 → **신규 user-facing AI 라우트** 필요), (b) **AskedItem** 데이터 모델(user_id, source[reading/segment+위치], 하이라이트 텍스트, 질문, 응답, timestamp — DB 전무) + 질문 히스토리 탭, (c) **월 캡 + 모델 티어링**(평소 경량, 필요시 상위, PRD §6.6 — 비용 레버), (d) return-to-flow UX(답 짧게).
- **갭 크기:** 진입 UI·AI 호출 패턴 재사용, 에이전트 라우트·AskedItem·캡/티어링은 신규. **주의:** 현행 anti-slop·표현 카드 프롬프트는 "딥다이브"라 return-to-flow와 철학 충돌 → 질문 에이전트는 짧은 답 전용 프롬프트 신규.

### 4.5 세션 조립 v1
- **재사용:** 스코어링 `packages/shared/src/lib/premium-curation.ts`(`scorePremiumSessionForProfile` 난도/관심사/상황 가중), 홈 조립 `app/(tabs)/index.tsx`(오늘 세션 fetch·렌더), `/api/premium/today` 라우트.
- **신규:** v1.3 = **읽기 1편(통짜) + 듣기 플레이리스트(여러 영상의 여러 구간)** 조립(PRD §6.4). 워밍업→피크→쿨다운 난도 아크·fun 랭킹은 후속 고도화(Out)이나, v1 최소는 "리딩 1 + 세그먼트 N" 묶기. 기존 단일 세션 응답형 → {reading_piece, segments[]} 응답형으로 교체.
- **갭 크기:** 스코어링·홈 골격 재사용, 조립 응답 구조는 신규.

### 4.6 최소 레벨 시드
- **재사용:** `onboarding.tsx` 레벨 4밴드 + 관심사/상황/장르 + `updateLearningProfile`로 `users` 영속. **가장 싼 viable 시드 = 기존 온보딩 그대로** → `level_band`(4밴드)로 UserVocabProfile 초기 known-word set을 밴드 추정값으로 채움. 풀 CAT+pseudoword 진단은 Out.
- **신규:** band → 초기 known-word set 매핑 테이블(어느 빈도 밴드까지 known으로 가정). 이게 최소 시드의 유일한 신규 로직.

---

## 5. 데이터 모델 델타 (기존 → 필요)

> grep 확인: `video_segment|reading_piece|asked_item|channel_whitelist|known_word|vocab_profile` 모두 마이그레이션/코드에 **미발견** → v1.3 핵심 엔티티는 전부 신규.

| PRD §10 엔티티 | 기존 대응 | 델타 |
|---|---|---|
| **UserVocabProfile** (band 추정 + known-word set + 갱신 이력 + 추정 레벨) | `users.level_band`(4밴드, `migrations/20260418010000`) + `users.preferred_*`만 존재. known-word set 없음 | **신규 테이블** `user_vocab_profiles` (또는 users 확장 + `known_words` 별도). band seed는 기존에서 채움 |
| **ReadingPiece** (생성 텍스트, 포맷, 주제, 타깃 레벨, 커버리지, 검증 상태, 논픽션 소스 사실) | `premium_articles`(아티클, jsonb body) 유사하나 "큐레이션 1편" 모델. `PremiumArticle` 타입(types:264-271) | **신규 테이블** `reading_pieces`. 커버리지·검증상태·grounding 소스 필드 추가. premium_articles는 REMOVE |
| **VideoSegment** (parent_video_id, start/end, transcript, wpm, band coverage, topic tags, self_contained, channel_id) | `premium_sessions.{segment_start_time,segment_end_time,transcript}`(types:361-362) 부분 유사하나 세션=1구간 모델 | **신규 테이블** `video_segments` (영상당 N구간). wpm/band coverage/self_contained/channel_id 신규 |
| **Channel(whitelist)** (레벨 밴드, 시각/억양 태그, 주제, 활성) | `speakers`/`video_speakers` 테이블(`migrations/20260415090000`) 일부 유사하나 스피커≠채널 | **신규 테이블** `channels`. 화이트리스트 자산 (PRD §6.3 "쌓이는 자산") |
| **Session** (date, reading_piece, [segment...], 조립 메타) | `premium_sessions`(단일 영상 1세션), `learning_sessions`(구 모델) | **ADAPT/신규**: reading_piece_id + segment_ids[] 조립 구조. premium_sessions 6-스텝 jsonb 컬럼들 죽음 |
| **AskedItem** (user_id, source[reading/segment+위치], 하이라이트, 질문, 응답, timestamp) | `highlights`(text/sentenceId/userNote, types:561-570) 가장 가까우나 질문/응답 필드 없음 | **신규 테이블** `asked_items` (PRD §10 "v1.3 유일한 능동 persistence"). highlights 매퍼 패턴 재사용 |
| ~~SavedAtom/QuizItem~~ | `saved_sentences`, `playbook_entries`, `premium_expression_cards.saved_atoms` | **후속 이연** (PRD §10/§13). AskedItem이 시드 |

기존 유지(슬라이스 무관): `users`, `pronunciation_analyses`, `saved_sentences`, `card_comments`, `push_tokens`, recordings 버킷.

신규 마이그레이션 권고: `user_vocab_profiles`, `known_words`, `reading_pieces`, `channels`, `video_segments`, `asked_items`, v1.3 `sessions`(또는 premium_sessions 재정의). PREMIUM-001 테이블(`premium_expression_cards`, `premium_articles`, premium_sessions의 roleplay/delivery_analysis 컬럼) drop은 별도 정리 마이그레이션 — **데이터 미운영 전제로 안전**.

---

## 6. 레퍼런스 구현 (file:line)

### 6.1 LLM 호출 + JSON 스키마 강제 (리딩 생성·커버리지·질문 에이전트의 골격)
- Gemini 구조화 출력: `apps/web/src/lib/premium/expression-card-ai.ts:265-287` (`getGenerativeModel({ generationConfig: { responseMimeType:"application/json", responseSchema } })`).
- Azure OpenAI 구조화 출력: 같은 파일 `:210-263` (`response_format: { type:"json_schema", json_schema:{ strict:true, schema } }`).
- 폴백 stub(LLM 미설정 시): `:383-435`.
- 1-5 스코어 강제 + 하드 게이트 프롬프트: `apps/web/src/lib/premium/key-segment-ai.ts:134-174` (세그먼트 난도 스코어러 직접 레퍼런스).
- 모듈 생성(article 등) + anti-slop 통합: `apps/web/src/lib/premium/module-ai.ts:260-297`.
- 제공자: **Gemini(`@google/generative-ai`) + Azure OpenAI REST** — Anthropic 미사용. 환경변수 `GEMINI_API_KEY`/`AZURE_OPENAI_*`, 모델 `gemini-2.5-pro` 등, Flash 모델 거부(`expression-card-ai.ts:196-202`).

### 6.2 슬롭 검수 (리딩 픽션)
- `packages/shared/src/lib/premium-voice-rules.ts`: `PREMIUM_COPY_BANNED_TERMS`(:1-5), `PREMIUM_COPY_ABSTRACT_VERBS`(:20-27, 켜지/피어나/물들/스며들), `buildPremiumAntiSlopVoiceRules`(:29-36), `findPremiumCopySlop`(:38-59, 정규식 조합 탐지).

### 6.3 트랜스크립트 인제스트 (리스닝)
- `apps/web/src/lib/premium/youtube-transcript.ts`: yt-dlp 메타+자막(`:181-244`), youtube-transcript-api 폴백(`:288-309`), json3 파싱(`:42-66`), VTT 파싱(`:95-139`). 출력 `PremiumTranscriptLine[]`(id/text/startTime/endTime).
- 어드민 라우트: `apps/web/src/app/api/admin/premium/transcript/route.ts:1-50` (`requireAdmin()`, `{sourceUrl}` → transcript+metadata).

### 6.4 임베드 세그먼트 플레이어 + 싱크 (모바일)
- `apps/mobile/src/components/player/YouTubePlayer.tsx`: `react-native-youtube-iframe`(:10), `YouTubePlayerHandle{seekTo,getCurrentTime,getDuration}`(:14-16), `initialPlayerParams.start = startSeconds`(:76), `useImperativeHandle`(:52-62).
- 사용 예: `PremiumSessionScreen.tsx:129-134` (videoId + startSeconds = segment_start_time).
- 싱크: `apps/mobile/src/lib/premium-transcript-sync.ts:3-12` (`findPremiumActiveTranscriptLine`), 상수 100ms(:23).

### 6.5 하이라이트/텍스트 선택 + 글로스 진입점 (모바일)
- `apps/mobile/src/components/study/HighlightBottomSheet.tsx`: selection state(:33-43), `onSelectionChange`(:99), `onSave(userNote, selectedText?)`(:17-23). DB 매퍼 `packages/shared/src/lib/supabase-store.ts` `mapHighlightRow`.
- 단어/문장 AI 호출: `apps/mobile/src/lib/ai-api.ts` `analyzeSentence`(:338-358, `/api/analyze`), `fetchAiTip`(:316-334, `/api/ai-tip`). **주의: 이 웹 라우트는 현재 미구현 — 질문 에이전트 신규 라우트로 대체.**

### 6.6 서버사이드 entitlement (게이팅)
- `apps/web/src/lib/premium/entitlement.ts:20-56` (`resolvePremiumEntitlement` — `users.plan` 조회 + 7일 trial). 402 응답: `apps/web/src/app/api/premium/today/route.ts:15-20`. 어드민 가드: `apps/web/src/utils/supabase/admin-auth.ts` `requireAdmin()`.

### 6.7 fixture-mode 테스트 패턴
- `apps/mobile/src/lib/premium-api.ts:69-99` (fixture 트리거 조건 `__DEV__ && (flag||!apiUrl||prod)`, trial entitlement 반환). 테스트 `apps/mobile/src/__tests__/premium-api-fixture-mode.test.ts`.

### 6.8 repository/service 패턴
- `apps/web/src/lib/premium/repository.ts:1-201` (published/today 조회 + 하이드레이션). `packages/shared/src/lib/supabase-store.ts:120-424` (`createSupabaseStore` 팩토리 + row 매퍼). `@MX:ANCHOR createSupabaseStore`(fan_in≥3).

---

## 7. 리스크 · 미해결

1. **YouTube 세그먼트 임베드 + 저작권** (PRD §6.3/§12): 임베드로 호스팅 회피하나, react-native-youtube-iframe로 임의 start/end 구간만 재생 시 ToS·플레이어 제약 확인 필요. 영화·애니는 임베드 불가(별도 칸, Out).
2. **ASR/자막 품질 상속** (PRD §12): `youtube-transcript.ts`가 사람 자막 우선이나 자동(ASR) 폴백 시 오류가 글로스/번역 레이어로 상속. 자막 위 글로스가 동일 품질 기준 상속 필요.
3. **LLM 슬롭/grounding** (PRD §6.2/§12): 픽션 슬롭은 `findPremiumCopySlop` 재사용으로 일부 완화. 논픽션 grounding(사실 소스)은 신규 — 미구현 시 "틀린 사실을 영어로 가르침".
4. **에이전트 비용** (PRD §6.6): 월 캡 + 모델 티어링 미구현. 무제한 시 비용 폭증 + noticing 희석. 캡 수치는 오픈 디시전(PRD §14.6).
5. **client-only vs server-side entitlement 갭** (PRD §12): `entitlement.ts` 서버 게이트는 있으나, 모바일 `premium-api.ts` fixture-mode는 dev에서 무조건 trial 부여(`:88-93`) — 프로덕션 게이트가 서버 RLS로 강제되는지 재확인.
6. **RLS**: premium 3테이블은 public SELECT lockdown(`20260614000300`). v1.3 신규 테이블(reading_pieces 등)도 동일 서버 전용 RLS 필요. user_vocab_profiles/asked_items는 user 소유 RLS(본인만).
7. **모노레포 shared-type 커플링**: premium 타입이 `packages/shared/src/types/index.ts`에 집중 — 제거 시 web/mobile 양쪽 import 동시 깨짐. 타입 제거는 단계적(deprecate→교체→삭제).
8. **LLM 제공자 정렬**: 현행 Gemini+Azure. v1.3 모델 티어링(경량↔상위)을 어느 제공자로 할지 결정 필요. (참고: 본 저장소는 Anthropic 미사용.)
9. **auth**: 모바일 Bearer(`getAuthHeaders` premium-api.ts:41-52) + 웹 쿠키 세션(`requireAdmin`). v1.3 user-facing 질문 에이전트 라우트는 `requireApiUser()` Bearer 패턴 사용.

### 오픈 질문
- VideoSegment를 premium_sessions 재활용 vs 신규 테이블? (권고: 신규 — 영상당 N구간 + wpm/coverage 필드.)
- UserVocabProfile = users 확장 vs 별도 테이블 + known_words? (권고: 별도, 갱신 이력·known_words 행 폭발 대비.)
- 커버리지 검증의 known-word 판정 알고리즘(빈도 밴드 기반 vs 개인 set) v1 범위?
- 질문 에이전트 월 캡 수치 + 소프트/하드 (PRD §14.6 미정).

---

## 8. 권장 슬라이스 페이징 + 안전 코드 제거 계획

### 8.1 안전 제거 계획 (테스트 보존)
1. **Stage A (이미 삭제된 잔재 커밋):** §3.1의 `[D]` 항목들(쇼츠/롱폼/shadowing/study/daily-input/free-usage/session-access/saved-shorts/feed-categories + 대응 테스트). 작업트리 삭제를 그대로 staging/commit. 테스트도 함께 삭제됨 → 회귀 위험 낮음. `pnpm test` 양 앱 그린 확인.
2. **Stage B (PREMIUM-001 산물 단계적 제거):** §3.2 항목. 순서 = (1) UI 패널 제거(RoleplayPanel/ExpressionCardsPanel/DeliveryAnalysisPanel/CompletionPanel) → (2) AI 생성 라우트·lib(expression-card-ai, module-ai roleplay, prompt.md) → (3) shared 타입(PremiumRoleplay/PremiumExpressionCard 등) deprecate→제거 → (4) DB drop 마이그레이션(premium_expression_cards, premium_articles, roleplay/delivery_analysis 컬럼). 각 단계마다 타입 컴파일·테스트 그린 확인. **KEEP 목록(§3.3)은 절대 건드리지 않음** — 특히 voice-rules, youtube-transcript, YouTubePlayer, transcript-sync, entitlement, repository.
3. **Stage C (PREMIUM-001 SPEC deprecate):** `.moai/specs/SPEC-PREMIUM-001/spec.md` status → `Superseded by SPEC-INPUT-001`.

### 8.2 빌드 페이징 (수직 슬라이스)
- **Phase 1 — 데이터 모델 + 레벨 시드:** 신규 마이그레이션(user_vocab_profiles/known_words, reading_pieces, channels, video_segments, asked_items, sessions). shared 타입 추가. 온보딩 band-seed → 초기 known-word set 매핑. (재사용: onboarding.tsx, supabase-store 패턴.)
- **Phase 2 — 리딩 트랙:** ReadingPiece 생성 라우트(LLM 패턴 재사용) + 커버리지 자동 검증 + 픽션 슬롭 검수(voice-rules 재사용) + (논픽션 grounding 최소). 리딩 뷰어(ArticleReader ADAPT) + 탭-글로스 센서.
- **Phase 3 — 리스닝 트랙:** Channel 화이트리스트 시드(소수 수동) + 세그먼트 인제스트(youtube-transcript 재사용) + 난도 스코어(어휘 커버리지+wpm, key-segment-ai 패턴) + VideoSegment 인덱스. 세그먼트 플레이어(YouTubePlayer 재사용) + 자막 싱크(transcript-sync 재사용) + 탭-글로스.
- **Phase 4 — 하이라이트 질문 에이전트 + 히스토리:** user-facing 질문 라우트(LLM 패턴 + return-to-flow 짧은 답 프롬프트) + AskedItem 영속(highlights 패턴) + 질문 히스토리 탭 + 월 캡/모델 티어링.
- **Phase 5 — 세션 조립 v1:** 읽기 1 + 세그먼트 N 묶기(premium-curation 스코어링 재사용) + 홈(`(tabs)/index.tsx` ADAPT) + `/api/.../today` 응답형 교체.

각 Phase는 fixture-mode 테스트(premium-api 패턴) + 서버 entitlement 게이트(entitlement 재사용)를 동반한다.
