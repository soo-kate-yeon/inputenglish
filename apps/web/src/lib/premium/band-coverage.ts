/**
 * @MX:NOTE: [AUTO] Band coverage computation and topic tag extraction for video segments.
 * computeBandCoverage() produces a per-band coverage ratio jsonb for video_segments.band_coverage.
 * extractTopicTags() extracts deterministic keyword-based topic tags (v1, no LLM required).
 * @MX:SPEC: SPEC-INPUT-002 - Phase 1, Task 1.2 / 1.3 | SPEC-INPUT-003 REQ-VOCAB-F (backend swap)
 * @MX:NOTE: [AUTO] Band coverage is CUMULATIVE: each band covers words 1..N (most-to-least frequent).
 * beginner=500, basic=1500, conversation=3000, professional=6000. A word in the beginner
 * band is also counted for all higher bands.
 * @MX:NOTE: [AUTO] SPEC-INPUT-003 F-U3: BAND_SETS backend replaced with cumulativeKnownSet()
 * from @inputenglish/shared/lib/frequency-list. Signatures and cumulative semantics are
 * INVIOLABLE KEEP — only the backing data source changed (hand-seeds → canonical frequency list).
 */
import { tokenizeText } from "./reading-coverage";
import { BAND_WORD_COUNTS, cumulativeKnownSet } from "@inputenglish/shared";
import type { VocabBand } from "@inputenglish/shared";

// ── Frequency-list backed cumulative band sets (replaces hand-seeded BAND_SETS) ──
// @MX:NOTE: [AUTO] These sets are derived from the NGSL/NAWL canonical frequency list
// (CC BY-SA 4.0) via cumulativeKnownSet(). professional ⊇ conversation ⊇ basic ⊇ beginner.
// The sets are computed once at module load time for O(1) per-word lookup in computeBandCoverage.
const BAND_SETS: Record<VocabBand, Set<string>> = {
  beginner: cumulativeKnownSet("beginner"),
  basic: cumulativeKnownSet("basic"),
  conversation: cumulativeKnownSet("conversation"),
  professional: cumulativeKnownSet("professional"),
};

// All bands in order
const BANDS: VocabBand[] = [
  "beginner",
  "basic",
  "conversation",
  "professional",
];

// ── Band coverage ─────────────────────────────────────────────────────────────

/**
 * Compute per-band vocabulary coverage for a transcript text.
 *
 * Coverage is defined as: fraction of unique tokens in text that appear
 * within the cumulative word set for that band (most-frequent → band ceiling).
 *
 * Coverage is CUMULATIVE: professional coverage >= conversation >= basic >= beginner
 * for any given vocabulary.
 *
 * @returns Record<VocabBand, number> — coverage ratio 0..1 per band.
 *          Never returns empty {}; always has all four band keys.
 */
export function computeBandCoverage(
  transcriptText: string,
): Record<VocabBand, number> {
  const tokens = tokenizeText(transcriptText);
  const empty: Record<VocabBand, number> = {
    beginner: 0,
    basic: 0,
    conversation: 0,
    professional: 0,
  };

  if (tokens.length === 0) {
    return empty;
  }

  const uniqueTokens = [...new Set(tokens)];
  const totalUnique = uniqueTokens.length;

  const result = { ...empty };
  for (const band of BANDS) {
    const bandSet = BAND_SETS[band];
    const knownCount = uniqueTokens.filter((t) => bandSet.has(t)).length;
    result[band] = knownCount / totalUnique;
  }

  return result;
}

// ── Topic tags ────────────────────────────────────────────────────────────────

interface TopicKeywords {
  topic: string;
  keywords: string[];
}

// Deterministic keyword-based topic taxonomy (v1, no LLM)
// @MX:NOTE: [AUTO] v1 keyword taxonomy — extend via SPEC or upgrade to LLM
// classification in a future phase. Each topic has a keyword list; score by
// keyword frequency, emit top tags. Fallback: ["general"].
const TOPIC_TAXONOMY: TopicKeywords[] = [
  {
    topic: "technology",
    keywords: [
      "technology",
      "software",
      "hardware",
      "computer",
      "algorithm",
      "data",
      "code",
      "programming",
      "digital",
      "internet",
      "ai",
      "machine",
      "learning",
      "artificial",
      "intelligence",
      "robot",
      "automation",
      "cloud",
      "server",
      "network",
      "database",
      "developer",
      "engineer",
      "tech",
      "app",
      "mobile",
      "startup",
      "innovation",
      "system",
      "platform",
    ],
  },
  {
    topic: "business",
    keywords: [
      "business",
      "company",
      "market",
      "revenue",
      "profit",
      "loss",
      "sales",
      "product",
      "customer",
      "brand",
      "marketing",
      "strategy",
      "management",
      "ceo",
      "executive",
      "corporate",
      "enterprise",
      "industry",
      "commercial",
      "transaction",
      "deal",
      "acquisition",
      "merger",
      "startup",
      "investment",
      "funding",
      "venture",
    ],
  },
  {
    topic: "economy",
    keywords: [
      "economy",
      "economic",
      "finance",
      "financial",
      "stock",
      "market",
      "inflation",
      "gdp",
      "growth",
      "recession",
      "trade",
      "currency",
      "debt",
      "fiscal",
      "monetary",
      "bank",
      "banking",
      "interest",
      "rate",
      "tax",
      "policy",
      "regulation",
      "earnings",
      "shareholder",
      "investor",
      "quarter",
    ],
  },
  {
    topic: "politics",
    keywords: [
      "politics",
      "political",
      "government",
      "election",
      "vote",
      "democracy",
      "president",
      "congress",
      "senate",
      "law",
      "policy",
      "legislation",
      "reform",
      "party",
      "campaign",
      "candidate",
      "debate",
      "constitutional",
      "parliament",
      "minister",
      "official",
      "administration",
      "republican",
      "democrat",
      "liberal",
      "conservative",
    ],
  },
  {
    topic: "science",
    keywords: [
      "science",
      "scientific",
      "research",
      "study",
      "experiment",
      "hypothesis",
      "theory",
      "discovery",
      "biology",
      "chemistry",
      "physics",
      "medicine",
      "medical",
      "health",
      "climate",
      "environment",
      "genetics",
      "evolution",
      "space",
      "astronomy",
      "energy",
      "quantum",
      "molecular",
      "laboratory",
      "neuroscience",
    ],
  },
  {
    topic: "culture",
    keywords: [
      "culture",
      "art",
      "music",
      "film",
      "movie",
      "book",
      "literature",
      "sport",
      "fashion",
      "design",
      "entertainment",
      "celebrity",
      "festival",
      "history",
      "tradition",
      "social",
      "society",
      "diversity",
      "religion",
      "philosophy",
      "education",
      "language",
    ],
  },
  {
    topic: "health",
    keywords: [
      "health",
      "medical",
      "doctor",
      "patient",
      "hospital",
      "disease",
      "treatment",
      "medicine",
      "mental",
      "wellness",
      "fitness",
      "diet",
      "nutrition",
      "exercise",
      "therapy",
      "vaccine",
      "virus",
      "pandemic",
      "symptom",
      "diagnosis",
      "surgery",
    ],
  },
];

const MAX_TAGS = 5;
const MIN_KEYWORD_MATCHES = 2;

/**
 * Extract topic tags from transcript text using deterministic keyword matching.
 *
 * v1 algorithm: tokenize → count keyword hits per topic → sort by hit count →
 * return top-N topics that exceed MIN_KEYWORD_MATCHES threshold.
 * Fallback: ["general"] if no topic exceeds the threshold.
 *
 * @returns string[] — 1 to MAX_TAGS tags, no duplicates. Never returns [].
 */
export function extractTopicTags(transcriptText: string): string[] {
  const tokens = tokenizeText(transcriptText);
  if (tokens.length === 0) {
    return ["general"];
  }

  const tokenSet = new Set(tokens);

  const scores: Array<{ topic: string; score: number }> = TOPIC_TAXONOMY.map(
    ({ topic, keywords }) => {
      const score = keywords.filter((kw) => tokenSet.has(kw)).length;
      return { topic, score };
    },
  );

  const matched = scores
    .filter(({ score }) => score >= MIN_KEYWORD_MATCHES)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_TAGS)
    .map(({ topic }) => topic);

  return matched.length > 0 ? matched : ["general"];
}

// Re-export BAND_WORD_COUNTS for consumers that need to know band sizes
export { BAND_WORD_COUNTS };
