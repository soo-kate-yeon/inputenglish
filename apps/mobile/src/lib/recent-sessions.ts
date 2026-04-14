import storage from "./mmkv";

interface RecentEntry {
  sessionId: string;
  videoId: string;
  visitedAt: number;
}

const KEY = "recent-sessions-v1";
const MAX_ENTRIES = 20;

function readEntries(): RecentEntry[] {
  const raw = storage.getString(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RecentEntry[];
  } catch {
    return [];
  }
}

export function getRecentSessionIds(): string[] {
  return readEntries().map((e) => e.sessionId);
}

export function recordSessionVisit(sessionId: string, videoId: string): void {
  const entries = readEntries().filter((e) => e.sessionId !== sessionId);
  entries.unshift({ sessionId, videoId, visitedAt: Date.now() });
  storage.set(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}
