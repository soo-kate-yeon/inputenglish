export interface Sentence {
  id: string;
  text: string;
  startTime: number; // seconds
  endTime: number;
  translation?: string;

  // Note information
  notes?: {
    difficultyTags: string[]; // ["연음", "문법", "발음", "속도"]
    aiTip?: string;
  };

  // Highlight information
  highlights: Highlight[];
}

export interface Highlight {
  id: string;
  text: string; // selected word/phrase
  startOffset: number; // position in sentence
  endOffset: number;
  caption: string;
  color: string; // highlighter color
}

export interface StudySession {
  id: string;
  videoId: string;
  videoTitle: string;
  createdAt: Date;
  updatedAt: Date;
  sentences: Sentence[];
  currentPhase: "blind" | "script" | "shadowing";
  isCompleted: boolean;
}

export interface ShadowingRecord {
  sentenceId: string;
  recordingBlob: Blob;
  timestamp: Date;
}

export interface TranscriptItem {
  text: string;
  start: number;
  duration: number;
  offset: number;
  lang: string;
}

export interface CuratedVideo {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url?: string;
  duration?: string;
  channel_name?: string;

  // Snippet-specific fields
  snippet_start_time: number; // seconds
  snippet_end_time: number; // seconds
  snippet_duration: number; // auto-calculated
  transcript: Sentence[]; // Only snippet sentences

  // Metadata
  difficulty?: "beginner" | "intermediate" | "advanced";
  tags?: string[];

  // Legal protection
  source_url: string;
  attribution: string;

  created_at: string;
  created_by?: string;
}

export interface Speaker {
  id: string;
  slug: string;
  name: string;
  name_ko?: string | null;
  headline?: string | null;
  bio_short?: string | null;
  description_long?: string | null;
  speaking_focus?: string | null;
  avatar_url?: string | null;
  organization?: string | null;
  role_title?: string | null;
  is_featured: boolean;
  sort_order: number;
  status: "active" | "hidden";
  created_at?: string;
  updated_at?: string;
}

export const LEARNING_LEVEL_BANDS = [
  "beginner",
  "basic",
  "conversation",
  "professional",
] as const;

export type LearningLevelBand = (typeof LEARNING_LEVEL_BANDS)[number];

export const LEARNING_GOAL_MODES = ["pronunciation", "expression"] as const;

export type LearningGoalMode = (typeof LEARNING_GOAL_MODES)[number];

export const SPEAKING_SITUATIONS = [
  "daily-chat",
  "friendship-romance",
  "school-work",
  "presentation-meeting",
  "interview",
  "service-industry",
  "self-intro-smalltalk",
] as const;

export type SpeakingSituation = (typeof SPEAKING_SITUATIONS)[number];

export const SPEAKING_SITUATION_LABELS: Record<SpeakingSituation, string> = {
  "daily-chat": "일상 잡담",
  "friendship-romance": "친구/연애",
  "school-work": "학교/업무",
  "presentation-meeting": "발표/회의",
  interview: "인터뷰",
  "service-industry": "서비스직",
  "self-intro-smalltalk": "자기소개/스몰토크",
};

export interface LearningProfile {
  user_id: string;
  level_band: LearningLevelBand | null;
  goal_mode: LearningGoalMode | null;
  focus_tags: string[];
  preferred_speakers: string[];
  preferred_situations: SpeakingSituation[];
  preferred_source_types: SessionSourceType[];
  preferred_genres: Genre[];
  onboarding_completed_at: string | null;
  updated_at?: string | null;
}

export interface FeaturedSpeaker {
  id: string;
  slug: string;
  name: string;
  headline?: string | null;
  image_url?: string | null;
  video_count: number;
  session_count: number;
}

export const SESSION_SOURCE_TYPES = [
  "keynote",
  "demo",
  "earnings-call",
  "podcast",
  "interview",
  "panel",
  "public-speech",
  "talk-show",
  "vlog",
  "scripted-drama",
] as const;

export type SessionSourceType = (typeof SESSION_SOURCE_TYPES)[number];

export const GENRES = [
  "politics",
  "tech",
  "economy",
  "current-affairs",
  "news",
  "business",
  "entertainment",
  "lifestyle",
] as const;

export type Genre = (typeof GENRES)[number];

export const PRACTICE_MODES = [
  "slot-in",
  "role-play",
  "my-briefing",
  "bookmark",
] as const;

export type PracticeMode = (typeof PRACTICE_MODES)[number];

export const PLAYBOOK_MASTERY_STATUSES = [
  "new",
  "practicing",
  "mastered",
] as const;

export type PlaybookMasteryStatus = (typeof PLAYBOOK_MASTERY_STATUSES)[number];

export interface KeyVocabularyEntry {
  expression: string;
  example: string;
  translation?: string;
  pronunciation_note?: string; // v2: 강세·연음 힌트
}

export interface CommonMistake {
  mistake: string; // 한국인이 흔히 하는 실수
  correction: string; // 자연스러운 표현
  why: string; // 왜 틀리는지
}

export interface SessionContext {
  session_id?: string;
  /** @deprecated Use expected_takeaway instead. Kept optional for backward compat with existing DB rows. */
  strategic_intent?: string;
  reusable_scenarios: string[];
  key_vocabulary: (string | KeyVocabularyEntry)[];
  grammar_rhetoric_note: string;
  expected_takeaway: string;
  common_mistakes?: CommonMistake[]; // v2: L1 간섭 패턴
  generated_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

// ==================== Premium Session Types ====================

/** @deprecated - Remove after Stage B(4) DB drop (premium_sessions/premium_expression_cards/premium_articles tables) */
export const PREMIUM_SESSION_STEPS = [
  "article",
  "content-catch",
  "delivery-analysis",
  "expression-cards",
  "roleplay",
  "completion",
] as const;

/** @deprecated - Remove after Stage B(4) DB drop */
export type PremiumSessionStep = (typeof PREMIUM_SESSION_STEPS)[number];

export const PREMIUM_SESSION_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;

export type PremiumSessionStatus = (typeof PREMIUM_SESSION_STATUSES)[number];

export const PREMIUM_EXPRESSION_DEPTHS = ["anchor", "support"] as const;

export type PremiumExpressionDepth = (typeof PREMIUM_EXPRESSION_DEPTHS)[number];

export interface PremiumTranscriptLine {
  id: string;
  text: string;
  translation?: string;
  startTime: number;
  endTime: number;
  speaker?: string | null;
  delivery_note?: string | null;
  analysis_note?: string | null;
}

export interface PremiumArticle {
  title: string;
  subtitle?: string | null;
  body: string;
  summary_bullets?: string[];
  reading_minutes?: number | null;
  reviewed: boolean;
}

/** @deprecated - Remove after Stage B(4) DB drop */
export interface PremiumDeliveryAnalysis {
  id: string;
  line_id: string;
  intonation_note: string;
  style_note: string;
  coaching_note: string;
  reviewed: boolean;
}

export interface PremiumExpressionPronunciation {
  stress: string;
  linking: string;
  trap_ko: string;
  ipa: string;
  say_it_ko: string;
  drill: string;
}

export interface PremiumExpressionVariation {
  en: string;
  when_ko: string;
}

export interface PremiumExpressionSavedAtoms {
  headword: string;
  one_line_nuance_ko: string;
  register_ko: string;
  examples: string[];
}

/** @deprecated - Remove after Stage B(4) DB drop (premium_expression_cards table) */
export interface PremiumExpressionCard {
  id: string;
  session_id?: string;
  source_sentence_id?: string | null;
  order_index: number;
  depth: PremiumExpressionDepth;
  expression: string;
  source_line: string;
  timestamp: string;
  natural_meaning_ko: string;
  story: string;
  pronunciation: PremiumExpressionPronunciation;
  variations: PremiumExpressionVariation[];
  saved_atoms: PremiumExpressionSavedAtoms;
  reviewed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PremiumRoleplayTurn {
  id: string;
  speaker: "coach" | "user";
  avatar_label?: string | null;
  line?: string | null;
  translation?: string | null;
  hidden?: boolean;
  reference_text?: string | null;
  expression_ids?: string[];
}

/** @deprecated - Remove after Stage B(4) DB drop */
export interface PremiumRoleplay {
  title: string;
  situation: string;
  user_role: string;
  partner_role: string;
  turns: PremiumRoleplayTurn[];
  target_expression_ids: string[];
  analysis_reference_text?: string | null;
  reviewed: boolean;
}

export interface PremiumSession {
  id: string;
  slug?: string | null;
  source_video_id: string;
  source_url: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  channel_name?: string | null;
  speaker_name?: string | null;
  source_type?: SessionSourceType | null;
  genre?: Genre | null;
  speaking_situations?: SpeakingSituation[];
  interest_tags?: string[];
  difficulty_level?: 1 | 2 | 3 | 4 | 5 | null;
  duration_seconds: number;
  segment_start_time: number;
  segment_end_time: number;
  transcript: PremiumTranscriptLine[];
  article: PremiumArticle;
  delivery_analysis: PremiumDeliveryAnalysis[];
  expression_cards: PremiumExpressionCard[];
  roleplay: PremiumRoleplay;
  status: PremiumSessionStatus;
  reviewed: boolean;
  published_on?: string | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PracticePrompt {
  id: string;
  session_id: string;
  mode: PracticeMode;
  title: string;
  prompt_text: string;
  guidance: string[];
  created_at?: string;
  updated_at?: string;
}

export interface PracticeCoachingSummary {
  summary: string;
  clarity_feedback: string;
  usefulness_feedback: string;
  next_step: string;
  pronunciation_feedback?: string;
  score?: number;
}

export type PronunciationAnalysisStatus =
  | "queued"
  | "processing"
  | "complete"
  | "failed";

export interface PronunciationWordIssue {
  word: string;
  error_type?: string | null;
  accuracy_score?: number | null;
}

export interface PronunciationFeedback {
  status: PronunciationAnalysisStatus;
  provider: "azure";
  reference_text: string;
  recognized_text?: string | null;
  overall_score?: number | null;
  accuracy_score?: number | null;
  fluency_score?: number | null;
  completeness_score?: number | null;
  prosody_score?: number | null;
  summary?: string | null;
  pacing_note?: string | null;
  chunking_note?: string | null;
  stress_note?: string | null;
  ending_tone_note?: string | null;
  clarity_note?: string | null;
  next_focus?: string | null;
  confidence?: number | null;
  word_issues?: PronunciationWordIssue[];
}

export interface PronunciationAnalysisJob {
  analysis_id: string;
  status: PronunciationAnalysisStatus;
  provider: "azure";
  provider_locale: string;
  result?: PronunciationFeedback | null;
  error?: {
    code: string;
    message: string;
  } | null;
  requested_at?: string;
  completed_at?: string | null;
}

export interface PracticeAttempt {
  id: string;
  session_id: string;
  source_video_id: string;
  source_sentence: string;
  mode: PracticeMode;
  response_text?: string;
  recording_url?: string;
  coaching_summary?: PracticeCoachingSummary | null;
  attempt_metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface PlaybookEntry {
  id: string;
  session_id: string;
  source_video_id: string;
  source_sentence: string;
  practice_mode: PracticeMode;
  user_rewrite: string;
  attempt_metadata?: Record<string, unknown>;
  mastery_status: PlaybookMasteryStatus;
  created_at?: string;
  updated_at?: string;
}

export interface LearningSession {
  id: string;
  source_video_id: string;
  longform_pack_id?: string | null;
  title: string;
  subtitle?: string;
  description?: string;
  duration: number; // seconds (auto-calculated)
  sentence_ids: string[];
  start_time: number; // seconds
  end_time: number; // seconds
  thumbnail_url?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  difficulty_level?: 1 | 2 | 3 | 4 | 5;
  speaking_situations?: SpeakingSituation[];
  order_index: number;
  source_type?: SessionSourceType;
  genre?: Genre;
  primary_speaker_id?: string | null;
  primary_speaker_name?: string | null;
  primary_speaker_slug?: string | null;
  primary_speaker_description?: string | null;
  primary_speaker_avatar_url?: string | null;
  created_at: string;
  created_by?: string;

  // Populated fields (optional, for UI convenience)
  sentences?: Sentence[];
  source_video?: CuratedVideo;
  context?: SessionContext | null;
}

export interface LongformContext {
  longform_pack_id?: string;
  speaker_snapshot: string;
  conversation_type: string;
  core_topics: string[];
  why_this_segment: string;
  listening_takeaway: string;
  generated_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LongformPack {
  id: string;
  source_video_id: string;
  title: string;
  subtitle?: string;
  description?: string;
  duration: number;
  sentence_ids: string[];
  start_time: number;
  end_time: number;
  primary_speaker_id?: string | null;
  primary_speaker_name?: string | null;
  primary_speaker_slug?: string | null;
  primary_speaker_description?: string | null;
  primary_speaker_avatar_url?: string | null;
  speaker_summary?: string | null;
  talk_summary?: string | null;
  topic_tags?: string[];
  content_tags?: string[];
  created_at: string;
  created_by?: string | null;
  updated_at?: string;
  context?: LongformContext | null;
}

// ==================== App Store Types ====================

export interface Video {
  id: string;
  title: string;
  thumbnailUrl: string;
  duration: string;
  description: string;
  sentenceCount?: number;
}

export interface Session {
  id: string;
  videoId: string;
  progress: number; // 0-100 (deprecated, kept for backward compatibility)
  lastAccessedAt: number;
  totalSentences: number;
  timeLeft: string;
  currentStep: 1 | 2; // 1 = listen without script, 2 = script view
  currentSentence?: number; // last viewed sentence index
}

// @MX:NOTE: [AUTO] AppHighlight is the DB-persisted highlight (server-side), distinct from
// the UI Highlight above which tracks text selection offsets and colors for the study view.
export interface AppHighlight {
  id: string;
  videoId: string;
  sentenceId: string;
  originalText: string;
  userNote?: string;
  createdAt: number;
}

export interface SavedSentence {
  id: string;
  videoId: string;
  premiumSessionId?: string;
  sessionTitle?: string;
  sentenceId: string; // Reference to the sentence ID
  sentenceText: string;
  startTime: number;
  endTime: number;
  createdAt: number;
}

export type CardCommentTargetType = "saved_sentence" | "highlight";

export interface CardComment {
  id: string;
  targetType: CardCommentTargetType;
  targetId: string;
  body: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface AINote {
  id: string;
  videoId: string;
  sentenceId: string;
  sentenceText: string;
  userFeedback: string[]; // e.g. ['too_fast', 'unknown_words']
  aiResponse: {
    analysis: string;
    tips: string;
    focusPoint: string;
  };
  createdAt: number;
}

// ==================== Transformation Practice Types ====================

export type ExerciseType =
  | "kr-to-en"
  | "qa-response"
  | "dialog-completion"
  | "situation-response"; // v2: 상황 설명 후 즉흥 발화

export type PatternType =
  | "declarative"
  | "interrogative"
  | "framing" // 맥락 먼저 깔기
  | "hedging" // 완화/단정 피하기
  | "transitioning" // 전환·되돌리기
  | "responding"; // 즉흥 대응

export interface DialogLine {
  speaker: string;
  text: string;
  is_blank: boolean;
}

export interface TransformationSet {
  id: string;
  session_id: string;
  target_pattern: string;
  pattern_type: PatternType;
  pattern_rationale?: string; // v2: 이 패턴을 고른 이유 (한국어)
  source_sentence_ids?: string[]; // v3: 타깃 패턴이 등장하는 원본 문장 ID 목록
  generated_by: "ai" | "manual";
  created_at: string;
  updated_at: string;
  exercises?: TransformationExercise[];
}

export interface TransformationExercise {
  id: string;
  set_id: string;
  page_order: number; // 2-5
  exercise_type: ExerciseType;
  instruction_text: string;
  source_korean?: string; // for kr-to-en
  question_text?: string; // for qa-response
  dialog_lines?: DialogLine[]; // for dialog-completion
  situation_text?: string; // v2: for situation-response
  reference_answer?: string;
  created_at: string;
  updated_at: string;
}

export interface TransformationAttempt {
  id: string;
  user_id: string;
  exercise_id: string;
  recording_url?: string;
  recording_duration?: number;
  completed_at: string;
  attempt_metadata?: Record<string, unknown>;
}

// === SPEC-INPUT-001 v1.3 Types ===

export type VocabBand = "beginner" | "basic" | "conversation" | "professional";

export interface UserVocabProfile {
  id: string;
  userId: string;
  estimatedBand: VocabBand;
  estimatedLevel: string; // CEFR: A1-C2
  updateHistory: Array<{
    timestamp: string;
    reason: string;
    previousBand?: VocabBand;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type KnownWordSource = "seed" | "tap" | "inferred";

export interface KnownWord {
  id: string;
  userId: string;
  lemma: string;
  frequencyBand: VocabBand | "advanced";
  source: KnownWordSource;
  lastSeen: string | null;
  createdAt: string;
}

export type ReadingFormat =
  | "noir"
  | "economic"
  | "business"
  | "editorial"
  | "dialogue"
  | "nonfiction";

export interface ReadingPiece {
  id: string;
  level: string;
  format: ReadingFormat;
  topic: string;
  body: string;
  coveragePct: number | null;
  validationStatus: "pending" | "approved" | "rejected";
  sourceFacts: Record<string, unknown>;
  userId: string | null;
  createdAt: string;
  /** Pool band assignment (SPEC-INPUT-002 Phase 2). Null for per-user pieces. */
  band?: VocabBand | null;
  /** Pool row expiry timestamp (SPEC-INPUT-002 Phase 2, REQ-AUTO-002-U2). */
  expiresAt?: string | null;
}

export interface Channel {
  id: string;
  name: string;
  youtubeChannelId: string;
  levelBand: VocabBand;
  visualAccentTags: string[];
  topics: string[];
  active: boolean;
  createdAt: string;
}

export interface TranscriptLine {
  start: number;
  end: number;
  text: string;
  /** Korean gloss translation — filled by ingest chain (SPEC-INPUT-002 Phase 1). Optional for backward compat. */
  translation?: string;
}

export interface VideoSegment {
  id: string;
  parentVideoId: string;
  channelId: string;
  startTime: number;
  endTime: number;
  transcript: TranscriptLine[];
  wpm: number | null;
  bandCoverage: Record<VocabBand, number>; // 0-1 fraction of words in each band
  topicTags: string[];
  selfContained: boolean;
  difficultyScore: number | null; // 1-5
  createdAt: string;
}

export interface AskedItemSourceRef {
  type: "reading" | "segment";
  pieceId: string;
  position?: number;
}

export interface AskedItem {
  id: string;
  userId: string;
  sourceType: "reading" | "segment";
  sourceRef: AskedItemSourceRef;
  highlightText: string;
  question: string | null;
  answer: string | null;
  createdAt: string;
}

export interface CiSession {
  id: string;
  userId: string;
  sessionDate: string;
  readingPieceId: string | null;
  segmentIds: string[];
  assemblyMeta: Record<string, unknown>;
  createdAt: string;
}
