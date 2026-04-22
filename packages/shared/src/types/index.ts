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
  "일상 잡담",
  "친구/연애",
  "학교/업무",
  "발표/회의",
  "인터뷰",
  "서비스직",
  "자기소개/스몰토크",
] as const;

export type SpeakingSituation = (typeof SPEAKING_SITUATIONS)[number];

export const VIDEO_CATEGORIES = [
  "브이로그",
  "영화 속 장면들",
  "드라마 속 장면들",
  "연설이나 강단 발표",
  "정보성 팟캐스트/인터뷰",
  "셀럽 인터뷰",
  "최신 시사 이슈",
  "티키타카를 배울 수 있는 팟캐스트/토크쇼",
] as const;

export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];

export interface LearningProfile {
  user_id: string;
  level_band: LearningLevelBand | null;
  goal_mode: LearningGoalMode | null;
  focus_tags: string[];
  preferred_speakers: string[];
  preferred_situations: string[];
  preferred_video_categories: string[];
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
] as const;

export type SessionSourceType = (typeof SESSION_SOURCE_TYPES)[number];

export const GENRES = [
  "politics",
  "fashion",
  "tech",
  "economy",
  "current-affairs",
  "news",
  "beauty",
  "art",
  "business",
] as const;

export type Genre = (typeof GENRES)[number];

export const SESSION_ROLE_RELEVANCE = [
  "engineer",
  "pm",
  "designer",
  "founder",
  "marketer",
] as const;

export type SessionRoleRelevance = (typeof SESSION_ROLE_RELEVANCE)[number];

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
  order_index: number;
  source_type?: SessionSourceType;
  genre?: Genre;
  role_relevance?: SessionRoleRelevance[];
  primary_speaker_id?: string | null;
  primary_speaker_name?: string | null;
  primary_speaker_slug?: string | null;
  primary_speaker_description?: string | null;
  primary_speaker_avatar_url?: string | null;
  premium_required?: boolean;
  created_at: string;
  created_by?: string;

  // Populated fields (optional, for UI convenience)
  sentences?: Sentence[];
  source_video?: CuratedVideo;
  context?: SessionContext | null;
}

export interface SceneRecommendation {
  startIndex: number;
  endIndex: number;
  title: string;
  reason: string;
  learningPoints: string[];
  estimatedDuration: number; // seconds
  difficulty?: "beginner" | "intermediate" | "advanced";
}

export interface SceneAnalysisResponse {
  scenes: SceneRecommendation[];
  totalAnalyzed: number;
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
  shorts?: LearningSession[];
}

export interface LongformRecommendation {
  startIndex: number;
  endIndex: number;
  title: string;
  subtitle: string;
  description: string;
  reason: string;
  speakerSummary: string;
  conversationType: string;
  topicTags: string[];
  contentTags: string[];
  estimatedDuration: number;
}

export interface ShortRecommendation extends SceneRecommendation {
  patternFocus: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

export interface ContentStructureAnalysisResponse {
  longform: LongformRecommendation;
  shorts: ShortRecommendation[];
  totalAnalyzed: number;
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
