---
id: SPEC-INPUT-001
version: 0.1.0
status: Planned
created: 2026-06-15
updated: 2026-06-15
author: soo-kate-yeon
priority: High
supersedes: SPEC-PREMIUM-001
platform: ios-primary, web-backend
---

# SPEC-INPUT-001: 수준 맞춤 Comprehensible Input 두 트랙 엔진 (수직 슬라이스)

> 본 SPEC은 단일 근거로 `research.md`(plan phase 코드베이스 전수 분석)와 **PRD v1.3**(`/Users/sooyeon/Downloads/inputeng_prd_v1.3.md`)을 따른다. 모든 인벤토리·KEEP/ADAPT/REMOVE 판정·데이터 모델 델타·페이징은 research를 따르며, 본 문서는 이를 테스트 가능한 EARS 요구사항으로 구체화한다. research와 충돌하지 않는다.
> Reference 인용은 `Reference: {file_path}:{line_range}` 형식을 사용한다.

---

## HISTORY

- **v0.1.0 — 2026-06-15** — PRD v1.3 + research.md 기반 초안 작성. SPEC-PREMIUM-001(월 ₩25,900 단일 큐레이션·6-스텝·롤플레잉 모델)을 supersede. 수직 슬라이스 5개 요구 모듈 정의(수준 모델·리딩·리스닝·질문 에이전트·세션 조립+레거시 정리). author: soo-kate-yeon.

---

## 1. 배경 (Background)

### 1.1 v1.1 → v1.2 → v1.3 피벗

인풋영어는 세 단계로 핵심 메커니즘을 옮겨 왔다(PRD §0).

- **v1.0–v1.1** — 데일리 **단일 표현 큐레이션** 모델. "앱으로 된 프리미엄 구몬", 하루 한 개 딥다이브 세션(₩25,900/월). moat = **에디토리얼 큐레이션 안목**. 이 모델이 곧 SPEC-PREMIUM-001이 구현하던 6-스텝 세션(아티클 → 내용캐치 → 분석듣기 → 핵심표현 카드 → 롤플레잉 → 완료)이다.
- **v1.2** — 핵심 메커니즘을 **수준 맞춤 인풋 볼륨**으로 전환. 표현 딥다이브는 *옵션 능동 레이어*로 강등. moat가 "에디토리얼 큐레이션 안목" → **"수준 측정·매칭 엔진"**으로 이동. 전환 사유: 제품명(인풋)과 메커니즘이 모순 — 하루 표현 1개는 Comprehensible Input이 아니라 explicit study다(PRD §0).
- **v1.3 (본 SPEC의 근거)** — ① 하이라이트 질문 에이전트 신규(PRD §6.6), ② 자체 트랜스크립트 파이프라인 확보로 자막/ASR 리스크 강등(PRD §12), ③ **복잡도 축소** — 딥다이브 카드·회상 퀴즈는 제외, 질문 항목은 **질문 히스토리 탭** 하나로만 저장·표시(PRD §6.5).

### 1.2 왜 SPEC-PREMIUM-001을 supersede 하는가

현행 `codex/premium-migration` 브랜치는 PREMIUM-001의 6-스텝 단일 큐레이션 모델을 거의 완성 단계까지 구현했다(타입 `PREMIUM_SESSION_STEPS`, DB `premium_sessions`/`premium_expression_cards`/`premium_articles`, 모바일 `PremiumSessionScreen.tsx` 1653줄, 웹 생성 파이프라인, 어드민 UI 2112줄 — research §2). 그러나 PRD v1.3은 이 모델을 **명시적으로 강등**한다(PRD §0, §6.5): "딥다이브 카드·회상 퀴즈는 v1.3 제외", "롤플레잉/표현 딥다이브는 옵션 능동 레이어로 강등 → 질문 히스토리 탭 하나로 최소화".

따라서 본 SPEC은 PREMIUM-001을 **대체(supersede)**하며, PREMIUM-001의 산물 중 v1.3가 죽이는 surface(RoleplayPanel, ExpressionCardsPanel, DeliveryAnalysisPanel, CompletionPanel, 6-스텝 enum, expression-card AI/prompt)를 단계적으로 제거한다(research §3.2, §8.1). PREMIUM-001 문서는 편집하지 않고 status만 `Superseded`로 표기한다(research §8.1 Stage C).
- Reference: `packages/shared/src/types/index.ts:230-237` (`PREMIUM_SESSION_STEPS` 6-스텝 enum — REMOVE 대상)
- Reference: `.moai/specs/SPEC-PREMIUM-001/spec.md:1-21` (supersede 대상 frontmatter·로드맵)

### 1.3 핵심 테제: comprehension density / 수준 측정·매칭 엔진

PRD §0–§3의 마케팅 척추는 **comprehension density**다. 보통 학습자는 1시간을 너무 어려운 네이티브 콘텐츠(절반도 이해 못 함)나 비-input(문법 앱)에 날린다. 인풋영어의 1시간은 매 분이 *실제로 이해되는* 입력이다. 이론적 근거(PRD §3):

- **Input Hypothesis (Krashen)** — 습득은 i+1의 *이해 가능한* 입력에서 일어난다.
- **Comprehensible = 단어 커버리지 95~98%** (Hu & Nation 계열). 모르는 단어가 100개 중 2~5개일 때 추측하며 이해된다. → "수준에 맞는다"가 *계산 가능한* 값이 된다. 이것이 본 엔진의 기술적 근거이며, 리딩 커버리지 자동 검증·리스닝 난도 스코어의 핵심 타깃 수치(2~5%)다.
- **우연적 어휘 습득은 노출 횟수(6~20회)에 의존** → 절대량(볼륨)이 커야 한다.
- **Compelling > Comprehensible** — fun은 리텐션 변수일 뿐 아니라 습득 변수(affective filter 하강). 세션 조립의 fun 랭킹 근거.
- **Noticing (Schmidt)** — 학습자가 *스스로* 둔 주의가 input을 intake로 만든다. 하이라이트 질문 에이전트(PRD §6.6)의 근거.

핵심 비대칭(PRD §6 서두): **리딩은 통짜 한 편(생성), 리스닝은 조각 모음(소싱)** — 그래서 두 트랙의 엔진이 다르다.

---

## 2. 목표 / 비목표 (Goals / Non-Goals)

### 2.1 Goals (수직 슬라이스 = 일일 세션 경험)

| # | 목표 | PRD 근거 |
|---|------|---------|
| G1 | 최소 레벨 시드: 온보딩 band-seed → 초기 known-word set + 탭-투-글로스 런타임 센서 + 자가보정 루프(모르는 단어 비율 목표 2~5%) | §6.1, §7 |
| G2 | 리딩 트랙: 레벨×관심사×포맷 **온디맨드 생성 1편** + 커버리지 자동 검증(2~5%) + 픽션 슬롭 검수 + 논픽션 grounding 최소 | §6.2 |
| G3 | 리스닝 트랙: Channel 화이트리스트 + VideoSegment 인덱스 + 임베드 세그먼트 플레이어 + 난도 스코어(어휘 커버리지+wpm) + 자족성 게이트 + 자막 싱크·탭글로스 | §6.3 |
| G4 | 하이라이트 질문 에이전트: 하이라이트 → 짧은 답 → return-to-flow + AskedItem 영속 + 질문 히스토리 탭 + 월 캡·모델 티어링 | §6.5, §6.6 |
| G5 | 세션 조립 v1: 읽기 1편 + 세그먼트 N 묶기 + **서버사이드 entitlement 게이트** + 레거시(PREMIUM-001·구 잔재) 정리 | §6.4, §12 |

### 2.2 Non-Goals (명시적 제외 — 후속 SPEC, 시드 호환)

본 슬라이스는 아래를 **구현하지 않는다**(PRD §13 Out, research §1.3). 데이터는 시드 호환으로 남긴다.

- **풀 온보딩 어휘 진단** — CAT(적응형) + pseudoword 앵커. 본 슬라이스는 band-seed 4밴드만 사용(PRD §7).
- **사전/사후 측정 + 환불 구조** (PRD §4.1, §11).
- **가격(99k/66k) + 친구 코드** (PRD §4.4). entitlement 게이트 *메커니즘*만 슬라이스 In, 가격 정책은 Out.
- **개인 known-word set 런타임 누적 고도화** — 본 슬라이스는 탭 신호 수집·기본 갱신까지(PRD §13 Out).
- **세션 조립 난도 아크(워밍업→피크→쿨다운)·fun 랭킹 고도화** — v1은 "리딩 1 + 세그먼트 N" 최소 묶기(PRD §6.4).
- **영화·애니 외부 포인터 통합** (PRD §6.3, §13 Out).
- **표현 딥다이브 카드 / 내 표현 사전 큐레이션 / 회상 퀴즈(spaced retrieval)** (PRD §6.5, §13 Out).
- **명시적 제외 표면(절대 노출 금지):** roleplay surface 없음, expression deep-dive card surface 없음, 6-스텝 단일 큐레이션 세션 surface 없음. (REQ-INPUT-005-U2 unwanted-behavior로 강제.)

---

## 3. EARS 요구사항

> EARS 5종: Ubiquitous(항상), Event-driven(WHEN), State-driven(WHILE), Optional(WHERE), Unwanted(IF/THEN ... shall not). 기술 식별자는 영어로 유지한다. 각 모듈 ≤ 약 6개.

### REQ-INPUT-001 — 수준 모델 + 최소 레벨 시드

심장(PRD §6.1): band 추정 → 개인 known-word set, 탭-투-글로스 = 이해 보조 UX이자 난도 센서, 자가보정 루프 목표 2~5%.
관련 데이터: `user_vocab_profiles`, `known_words` (신규, research §5). 시드 입력: `onboarding.tsx` band-seed 재사용.

- **U1 (Ubiquitous):** 시스템은 항상 각 사용자에 대해 `UserVocabProfile`(band 추정 + known-word set + 추정 레벨 + 갱신 이력)을 단일 레코드로 유지해야 한다.
  - Reference: `apps/mobile/app/onboarding.tsx` (band-seed 입력) · `supabase/migrations/20260418010000` (`users.level_band` 4밴드)
- **U2 (Ubiquitous):** 시스템은 항상 known-word 판정을 빈도 밴드 기준으로 계산하며, 초기 known-word set은 온보딩 `level_band`(beginner/basic/conversation/professional)의 밴드 추정값으로 채워야 한다.
- **E1 (Event-driven, WHEN):** WHEN 사용자가 리딩·세그먼트 텍스트의 단어를 탭하여 글로스를 요청하면, THEN 시스템은 해당 단어를 "모름 신호"로 기록하고 `UserVocabProfile`의 known-word set 갱신 이력에 반영해야 한다.
  - Reference: `apps/mobile/src/lib/premium-transcript-sync.ts:3-12` (탭 위치→active line 계산 재사용)
- **W1 (State-driven, WHILE):** WHILE 콘텐츠 내 모르는 단어 비율이 목표 밴드(2~5%)를 벗어난 상태인 동안, THEN 시스템은 다음 콘텐츠 추천 난도를 조정해야 한다(10% 초과 → 난도↓, 0% → 난도↑).
- **W2 (State-driven, WHILE):** WHILE 사용자가 사용 첫 3~5일 윈도우 내에 있는 동안, THEN 시스템은 추정 밴드를 의도적으로 흔들어(탐색) 수렴을 가속해야 한다.
- **O1 (Optional, WHERE):** WHERE 리스닝 보정 클립이 제공되는 경우, 시스템은 짧은 이해 체크로 초기 추정값만 보정할 수 있다(풀 진단 아님).

### REQ-INPUT-002 — 리딩 트랙: 온디맨드 생성 1편

PRD §6.2: 그날 그 유저 수준·관심사·포맷으로 한 편을 통으로 생성(저작권 0, 무한 공급, 관심사×레벨 충돌 해소). 포맷 = 난도 차원.
관련 데이터: `reading_pieces` (신규). LLM·슬롭 검수 패턴 재사용.

- **U1 (Ubiquitous):** 시스템은 항상 리딩 생성 요청을 사용자 추정 레벨(i+1) × 관심사 × 포맷(소설·경제·경영·사설·대화 등)을 입력으로 받아 단일 `ReadingPiece`로 생성해야 한다.
  - Reference: `apps/web/src/lib/premium/expression-card-ai.ts:265-287` (Gemini `responseSchema`) · `:210-263` (Azure `json_schema strict`) · `:383-435` (LLM 미설정 폴백 stub)
- **E1 (Event-driven, WHEN):** WHEN `ReadingPiece` 생성이 완료되면, THEN 시스템은 known-word set 대조로 모르는 단어 커버리지를 자동 검증하고, 목표(2~5%)를 벗어나면 재생성하거나 난도를 재조정해야 한다.
- **W1 (State-driven, WHILE):** WHILE 포맷이 픽션인 동안, THEN 시스템은 anti-slop 슬롭 검수(켜지다/피어나다/물들다 등 금지)를 통과하지 못한 `ReadingPiece`를 발행하지 않아야 한다.
  - Reference: `packages/shared/src/lib/premium-voice-rules.ts:38-59` (`findPremiumCopySlop`) · `:20-27` (`PREMIUM_COPY_ABSTRACT_VERBS`)
- **W2 (State-driven, WHILE):** WHILE 포맷이 논픽션인 동안, THEN 시스템은 진짜 사실 소스를 grounding으로 끌어와 그 위에 레벨 통제 문장만 생성해야 한다(자유 생성으로 사실을 지어내지 않음).
- **U2 (Unwanted, IF/THEN):** IF `ReadingPiece`가 커버리지 검증 또는 슬롭/grounding 검수를 통과하지 못했다면, THEN 시스템은 해당 piece를 사용자에게 노출하지 않아야 한다.
- **O1 (Optional, WHERE):** WHERE Simple English Wikipedia authentic seam이 활성화된 경우, 시스템은 Simple/일반판을 난도 사다리로 활용할 수 있다.

### REQ-INPUT-003 — 리스닝 트랙: 세그먼트 인덱스 + 임베드 플레이어

PRD §6.3: 라이브 검색 아님 — 오프라인 인제스트 → 난도 점수 → 세그먼트 인덱싱. 단위는 영상이 아니라 **세그먼트(구간)**. 화이트리스트 = 척추.
관련 데이터: `channels`, `video_segments` (신규). 인제스트·플레이어·싱크 패턴 재사용.

- **U1 (Ubiquitous):** 시스템은 항상 리스닝 후보를 CI 친화 `Channel` 화이트리스트(명료 발음, ~130 wpm, 시각 단서, 레벨 밴드 태깅) 내에서만 인덱싱해야 한다.
- **U2 (Ubiquitous):** 시스템은 항상 인덱스 단위를 영상이 아닌 `VideoSegment`(`parent_video_id`, start/end, transcript, wpm, band coverage, topic tags, self_contained, channel_id)로 저장해야 한다.
  - Reference: `apps/web/src/lib/premium/youtube-transcript.ts:181-244` (yt-dlp 메타+자막) · `:288-309` (youtube-transcript-api 폴백)
- **E1 (Event-driven, WHEN):** WHEN 트랜스크립트 인제스트가 완료되면, THEN 시스템은 난도 스코어를 어휘 커버리지(95~98%) + 발화 속도(wpm)로 산출하고 세그먼트에 부착해야 한다.
  - Reference: `apps/web/src/lib/premium/key-segment-ai.ts:134-174` (1-5 스코어·하드 게이트 스코어러 패턴)
- **E2 (Event-driven, WHEN):** WHEN 사용자가 세그먼트를 재생하면, THEN 시스템은 임베드 플레이어로 `start/end` 구간만 재생하고 트랜스크립트를 100ms 단위로 싱크하며 탭-투-글로스를 활성화해야 한다.
  - Reference: `apps/mobile/src/components/player/YouTubePlayer.tsx` (`startSeconds`/`seekTo`/`getCurrentTime`) · `apps/mobile/src/lib/premium-transcript-sync.ts:23` (100ms 싱크 상수)
- **W1 (State-driven, WHILE):** WHILE 세그먼트가 자족성 게이트를 통과하지 못한 상태(앞을 가리킴: "아까 그것…")인 동안, THEN 시스템은 해당 세그먼트를 사용자에게 추천하지 않아야 한다.
- **U3 (Unwanted, IF/THEN):** IF 세그먼트 자막이 사람 자막이 아닌 ASR 전용이고 글로스/번역 품질 상속이 보장되지 않는다면, THEN 시스템은 글로스 품질 경고를 표기하거나 해당 세그먼트를 강등해야 한다.

### REQ-INPUT-004 — 하이라이트 질문 에이전트 + 질문 히스토리

PRD §6.6: 인풋 소비 중 하이라이트 → 즉시 질문(뜻·뉘앙스·용법) → **짧은 답** → input 흐름으로 return-to-flow. PRD §6.5: 질문 항목은 히스토리 탭에만 저장(퀴즈·카드 없음).
관련 데이터: `asked_items` (신규, v1.3 유일한 능동 persistence). 진입 UI·AI 호출 패턴 재사용.

- **E1 (Event-driven, WHEN):** WHEN 사용자가 리딩·세그먼트 텍스트를 하이라이트하고 질문을 보내면, THEN 시스템은 짧은 답(뜻·뉘앙스·용법·왜 이렇게 쓰는지)을 반환하고 사용자를 input 흐름으로 복귀시켜야 한다.
  - Reference: `apps/mobile/src/components/study/HighlightBottomSheet.tsx:33-43,99` (selection·`onSelectionChange`·`onSave`) · `apps/mobile/src/lib/ai-api.ts:316-358` (`fetchAiTip`/`analyzeSentence` 호출 패턴; **해당 웹 라우트는 미구현 → 신규 user-facing 라우트 필요**)
- **U1 (Ubiquitous):** 시스템은 항상 질문 항목을 `AskedItem`(user_id, source[reading/segment + 위치], 하이라이트 텍스트, 질문, 응답, timestamp)으로 영속해야 한다.
  - Reference: `packages/shared/src/lib/supabase-store.ts` (`mapHighlightRow` 매퍼 패턴 → `AskedItem` 매퍼 추가)
- **E2 (Event-driven, WHEN):** WHEN 사용자가 질문 히스토리 탭을 열면, THEN 시스템은 저장된 `AskedItem`(하이라이트 + 질문 + 답변)을 재열람용으로 표시해야 한다.
- **W1 (State-driven, WHILE):** WHILE 사용자의 이번 달 질문 횟수가 월 캡 한도 내인 동안, THEN 시스템은 잔여 횟수를 긍정형("이번 달 질문 N개 남음")으로 표시하고 질문을 처리해야 한다.
- **U2 (Ubiquitous):** 시스템은 항상 질문 응답에 모델 티어링을 적용해야 한다(평소 경량 모델, 필요 시 상위 모델).
- **U3 (Unwanted, IF/THEN):** IF 사용자가 월 캡을 소진했다면, THEN 시스템은 추가 질문을 graceful하게 거절하고(흐름 차단·에러 없이) 다음 달 리셋 안내를 표시해야 한다.

### REQ-INPUT-005 — 세션 조립 v1 + 서버 entitlement + 레거시 정리 제약

PRD §6.4: 하루 = 읽기 1편(통짜) + 듣기 플레이리스트(여러 영상의 여러 구간). PRD §12: client-only 게이팅 갭을 서버 entitlement로 해소. research §8.1: 레거시 정리 제약.
관련 데이터: v1.3 `sessions`(reading_piece_id + segment_ids[]). entitlement 패턴 재사용.

- **E1 (Event-driven, WHEN):** WHEN 사용자가 오늘 세션을 요청하면, THEN 시스템은 읽기 1편(`ReadingPiece`)과 세그먼트 N개(`VideoSegment[]`)를 묶은 `Session`을 조립하여 반환해야 한다.
  - Reference: `apps/web/src/lib/premium/repository.ts:1-201` (today/published 조회·하이드레이션 패턴) · `packages/shared/src/lib/premium-curation.ts` (`scorePremiumSessionForProfile` 스코어링 재사용)
- **U1 (Ubiquitous):** 시스템은 항상 세션 콘텐츠 접근을 서버사이드 entitlement로 게이트해야 하며, entitlement가 없는 요청에는 콘텐츠를 반환하지 않아야 한다.
  - Reference: `apps/web/src/lib/premium/entitlement.ts:20-56` (`resolvePremiumEntitlement`) · `apps/web/src/app/api/premium/today/route.ts:15-20` (402 응답)
- **U2 (Unwanted, IF/THEN):** IF 세션·홈·라우트 어디에서든 roleplay 표면, expression-card 딥다이브 표면, 또는 6-스텝 단일 큐레이션 세션 표면이 노출되려 한다면, THEN 시스템은 이를 노출하지 않아야 한다(해당 surface는 도달 불가).
  - Reference (REMOVE 대상): `apps/mobile/src/components/premium/PremiumSessionScreen.tsx:617-906` (`RoleplayPanel`) · `:386-526` (`ExpressionCardsPanel`) · `:333-384` (`DeliveryAnalysisPanel`) · `:908-958` (`CompletionPanel`)
- **U3 (Unwanted, IF/THEN):** IF 요청이 인증되지 않았거나 Bearer 토큰이 유효하지 않다면, THEN 시스템은 세션 콘텐츠 대신 인증 오류(402/401)를 반환해야 한다.
  - Reference: `apps/mobile/src/lib/premium-api.ts:41-52,69-99` (auth 헤더·fixture-mode 패턴 — **프로덕션은 서버 RLS로 강제 재확인**)
- **U4 (Ubiquitous):** 시스템은 항상 v1.3 신규 사용자 소유 테이블(`user_vocab_profiles`, `known_words`, `asked_items`)에 본인-전용 RLS를, 콘텐츠 테이블(`reading_pieces`, `video_segments`, `channels`, `sessions`)에 서버 전용 RLS(public SELECT 없음)를 적용해야 한다.
  - Reference: `supabase/migrations/20260614000300_lock_premium_rls.sql` (public SELECT lockdown 패턴)
- **O1 (Optional, WHERE):** WHERE 일일 푸시가 설정된 경우, 시스템은 오늘 세션 준비 알림을 보낼 수 있다.
  - Reference: `apps/web/src/lib/premium/push-notifications.ts` (KEEP)

---

## 4. Traceability

| 요구 모듈 | PRD 근거 | research 근거 | 신규 데이터 | 핵심 재사용(INVIOLABLE KEEP) |
|---|---|---|---|---|
| REQ-INPUT-001 수준 모델·시드 | §6.1, §7 | §4.3, §4.6, §5 | `user_vocab_profiles`, `known_words` | onboarding band-seed, transcript-sync |
| REQ-INPUT-002 리딩 | §6.2 | §4.1, §6.1, §6.2 | `reading_pieces` | voice-rules, LLM 호출 패턴 |
| REQ-INPUT-003 리스닝 | §6.3 | §4.2, §6.3, §6.4 | `channels`, `video_segments` | youtube-transcript, YouTubePlayer, transcript-sync |
| REQ-INPUT-004 질문 에이전트 | §6.5, §6.6 | §4.4, §6.5 | `asked_items` | HighlightBottomSheet, supabase-store |
| REQ-INPUT-005 세션 조립·entitlement·정리 | §6.4, §12 | §3.1–§3.3, §6.6, §6.8, §8.1 | `sessions` (+ PREMIUM drop) | entitlement, repository/supabase-store |

> **INVIOLABLE KEEP (research §3.3, §8.1):** voice-rules, youtube-transcript, YouTubePlayer, premium-transcript-sync, entitlement, repository/supabase-store, HighlightBottomSheet, onboarding band-seed, fixture/auth 패턴은 절대 제거하지 않는다.

상세 구현 계획은 `plan.md`, 인수 기준은 `acceptance.md`를 참조한다.
