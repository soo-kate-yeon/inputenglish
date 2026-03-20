// @MX:NOTE: Re-exports transcript parsing functions from @inputenglish/shared.
// Implementation has moved to packages/shared/src/lib/transcript-parser.ts.
// This file is kept for backward compatibility with @/lib/transcript-parser imports.
export {
  parseTranscriptToSentences,
  parseRawTextToSentences,
  groupSentencesByMode,
  extractVideoId,
} from "@inputenglish/shared";
export type { TranscriptItem, Sentence } from "@inputenglish/shared";
