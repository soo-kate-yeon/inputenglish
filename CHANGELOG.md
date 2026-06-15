# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] — 2026-06-15

### Added — Comprehensible Input Two-Track Engine (SPEC-INPUT-001)

**Reading Track (on-demand generation)**

- `POST /api/premium/reading` — Gemini 2.5 Pro generation with Zipf-frequency coverage gate (2–5% unknown words), fiction slop check, nonfiction grounding validation, and Azure OpenAI fallback
- `ArticleReader` mobile component — renders `ReadingPiece` with tap-to-gloss word sensor and `onWordTap(lemma)` callback
- `reading-coverage.ts` — `tokenizeText`, `calculateUnknownRatio`, `verifyCoverage` utilities

**Listening Track (segment index + embed player)**

- `POST /api/admin/premium/ingest` — admin route: yt-dlp transcript fetch, 60–120s segment splitting, difficulty scoring, `VideoSegment` DB persistence
- `segment-scorer.ts` — `calculateWpm`, `scoreSegmentDifficulty` (1–5 score), `isSelfContained` self-contained gate
- `SegmentPlayer` mobile component — wraps `YouTubePlayer` with `startSeconds`/`seekTo`, 100ms transcript sync, active-line highlight, `onWordTap` callback
- Channel seed: TED-Ed (conversation), Kurzgesagt (basic), Crash Course (professional)

**Highlight Question Agent**

- `POST /api/premium/question` — Gemini Flash-gate (short answers → `gemini-2.5-flash`, complex → `gemini-2.5-pro`), 100/month soft cap with graceful model demotion (no hard block), `AskedItem` persistence
- `question-cap.ts` — `MONTHLY_QUESTION_CAP=100`, `getCapStatus`, `selectQuestionModel`
- `QuestionHistoryTab` mobile component — read-only `AskedItem` re-view (no quiz/card surface)
- `askHighlightQuestion()` added to `premium-api.ts`

**Session Assembly v1**

- `GET /api/premium/today` v1.3 — returns `{ session: { id, date, readingPiece, segments[], assemblyMeta }, remainingQuestionCap }`
- Home tab `ci-session-card` — displays today's CI session (reading piece title + segment count)

**Shared Infrastructure**

- DB migrations (7): `user_vocab_profiles`, `known_words`, `reading_pieces`, `channels`, `video_segments`, `asked_items`, `ci_sessions` with RLS policies
- `vocab-band.ts` — `judgeCoverage(ratio)` → `'too-easy'|'optimal'|'too-hard'`, `coverageDifficultyAdjustment` → `-1|0|1`, `getBandSeedMetadata`
- New shared types: `VocabBand`, `UserVocabProfile`, `KnownWord`, `ReadingPiece`, `Channel`, `VideoSegment`, `AskedItem`, `CiSession`
- `llm-utils.ts` — `callGeminiWithSchema()`, `callAzureOpenAI()`, `getAzureOpenAIConfig()`

### Removed — Legacy Premium Surface Cleanup

- **Stage B(1)**: `RoleplayPanel`, `ExpressionCardsPanel`, `DeliveryAnalysisPanel`, `CompletionPanel` removed from `PremiumSessionScreen`
- **Stage B(2)**: `expression-card-ai.ts` refactored to thin `llm-utils` wrapper; `generateExpressionCard` and `generateRoleplayScript` removed
- **Stage B(4)**: `premium_expression_cards` and `premium_articles` tables dropped; `roleplay`, `delivery_analysis` columns removed from `premium_sessions`

### Changed

- `GOOGLE_GENERATIVE_AI_API_KEY` env var renamed to `GEMINI_API_KEY` (update your `.env.local`)
- `GET /api/premium/today` response shape updated to v1.3 `TodaySessionResponse` (reading + segments + remainingQuestionCap)
- `SPEC-PREMIUM-001` status set to `Superseded by SPEC-INPUT-001`

### Deprecated

- `PremiumSessionStep`, `PremiumDeliveryAnalysis`, `PremiumExpressionCard`, `PremiumRoleplay`, `PREMIUM_SESSION_STEPS` — still exported for admin-route compatibility; removal planned after admin route migration (Stage B(3))

### Migration Notes

- Run `supabase db push` to apply 9 new migrations (7 add + 1 drop)
- Update `.env.local`: rename `GOOGLE_GENERATIVE_AI_API_KEY` → `GEMINI_API_KEY`; optionally add `AZURE_OPENAI_*` for reading fallback and `YT_DLP_PATH` for ingest
- Seed `channels` table: `psql < supabase/seeds/channels.sql`

---

### Added (SPEC-MOBILE-004, legacy)

- Audio recording hook with expo-av (M4A/AAC format) supporting idle/recording/playback state machine (SPEC-MOBILE-004)
- Shadowing screen with per-sentence recording, playback, and mode toggle (sentence/paragraph/total)
- RecordingBar component with recording duration display and playback progress tracking
- ShadowingHeader component with mode selection and study completion
- Microphone permission handling with user feedback alerts
- Background handling to pause recording and player on app backgrounding
- YouTube player component with `react-native-youtube-iframe` (SPEC-MOBILE-003)
- Listening screen with subtitle synchronization, loop repeat, speed control
- Sentence save/unsave with Supabase sync
- Home tab curated video list with difficulty badges
- Supabase direct query API client for mobile
- Database migrations for `curated_videos` table and RLS policies

### Changed

### Deprecated

### Removed

### Fixed

- Audio recording playback now resets position before replay (SPEC-MOBILE-004)
- Recording state properly cleaned up before reset to prevent race conditions and audio session locks (SPEC-MOBILE-004)
- crypto.randomUUID() replaced with generateId() helper for React Native Hermes compatibility (SPEC-MOBILE-004)

### Security
