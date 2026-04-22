import storage from "./mmkv";

export interface SavedShortSession {
  sessionId: string;
  videoId: string;
  savedAt: number;
}

const KEY = "saved-shorts-v1";
const MAX_ENTRIES = 50;

function readEntries(): SavedShortSession[] {
  const raw = storage.getString(KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as SavedShortSession[];
  } catch {
    return [];
  }
}

function writeEntries(entries: SavedShortSession[]): SavedShortSession[] {
  const nextEntries = entries.slice(0, MAX_ENTRIES);
  storage.set(KEY, JSON.stringify(nextEntries));
  return nextEntries;
}

export function getSavedShortSessions(): SavedShortSession[] {
  return readEntries();
}

export function getSavedShortSessionIds(): string[] {
  return readEntries().map((entry) => entry.sessionId);
}

export function isShortSessionSaved(sessionId: string): boolean {
  return readEntries().some((entry) => entry.sessionId === sessionId);
}

export function saveShortSession(
  sessionId: string,
  videoId: string,
): SavedShortSession[] {
  const entries = readEntries().filter(
    (entry) => entry.sessionId !== sessionId,
  );
  entries.unshift({
    sessionId,
    videoId,
    savedAt: Date.now(),
  });
  return writeEntries(entries);
}

export function unsaveShortSession(sessionId: string): SavedShortSession[] {
  const entries = readEntries().filter(
    (entry) => entry.sessionId !== sessionId,
  );
  return writeEntries(entries);
}

export function toggleSavedShortSession(
  sessionId: string,
  videoId: string,
): { saved: boolean; entries: SavedShortSession[] } {
  if (isShortSessionSaved(sessionId)) {
    return {
      saved: false,
      entries: unsaveShortSession(sessionId),
    };
  }

  return {
    saved: true,
    entries: saveShortSession(sessionId, videoId),
  };
}
