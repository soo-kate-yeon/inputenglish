import type { PronunciationAnalysisJob } from "@inputenglish/shared";
import storage from "@/lib/mmkv";

interface PronunciationAnalysisCacheParams {
  userId: string;
  source: "daily-input" | "study";
  sessionId?: string | null;
  sentenceId: string;
}

interface PronunciationAnalysisCacheEntry {
  job: PronunciationAnalysisJob;
  updatedAt: string;
}

function buildCacheKey(params: PronunciationAnalysisCacheParams): string {
  return [
    "pronunciation_analysis",
    params.userId,
    params.source,
    params.sessionId ?? "no-session",
    params.sentenceId,
  ].join(":");
}

export function readPronunciationAnalysisCache(
  params: PronunciationAnalysisCacheParams,
): PronunciationAnalysisJob | null {
  const raw = storage.getString(buildCacheKey(params));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PronunciationAnalysisCacheEntry;
    return parsed.job ?? null;
  } catch (error) {
    console.error(
      "[PronunciationAnalysisCache] Failed to parse cached entry:",
      error,
    );
    storage.delete(buildCacheKey(params));
    return null;
  }
}

export function writePronunciationAnalysisCache(
  params: PronunciationAnalysisCacheParams,
  job: PronunciationAnalysisJob,
) {
  const payload: PronunciationAnalysisCacheEntry = {
    job,
    updatedAt: new Date().toISOString(),
  };
  storage.set(buildCacheKey(params), JSON.stringify(payload));
}

export function clearPronunciationAnalysisCache(
  params: PronunciationAnalysisCacheParams,
) {
  storage.delete(buildCacheKey(params));
}
