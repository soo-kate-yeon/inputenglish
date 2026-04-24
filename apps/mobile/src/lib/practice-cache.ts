import { MMKV } from "react-native-mmkv";
import type { PracticePrompt } from "@inputenglish/shared";

const storage = new MMKV({ id: "practice-cache" });
const TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  data: PracticePrompt[];
  cachedAt: number;
}

export function getPracticePromptsCache(
  sessionId: string,
): PracticePrompt[] | null {
  const raw = storage.getString(sessionId);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.cachedAt > TTL_MS) {
      storage.delete(sessionId);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setPracticePromptsCache(
  sessionId: string,
  prompts: PracticePrompt[],
): void {
  const entry: CacheEntry = { data: prompts, cachedAt: Date.now() };
  try {
    storage.set(sessionId, JSON.stringify(entry));
  } catch {
    // best-effort
  }
}
