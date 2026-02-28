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

export interface LearningSession {
  id: string;
  source_video_id: string;
  title: string;
  description?: string;
  duration: number; // seconds (auto-calculated)
  sentence_ids: string[];
  start_time: number; // seconds
  end_time: number; // seconds
  thumbnail_url?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  order_index: number;
  created_at: string;
  created_by?: string;

  // Populated fields (optional, for UI convenience)
  sentences?: Sentence[];
  source_video?: CuratedVideo;
}

export interface SceneRecommendation {
  startIndex: number;
  endIndex: number;
  title: string;
  reason: string;
  learningPoints: string[];
  estimatedDuration: number; // seconds
}

export interface SceneAnalysisResponse {
  scenes: SceneRecommendation[];
  totalAnalyzed: number;
}
