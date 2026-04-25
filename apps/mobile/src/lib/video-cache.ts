import { MMKV } from "react-native-mmkv";
import type { CuratedVideo } from "@inputenglish/shared";

const storage = new MMKV({ id: "video-cache" });
const TTL_MS = 24 * 60 * 60 * 1000;
const REVALIDATE_AFTER_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  data: CuratedVideo;
  cachedAt: number;
}

export function getVideoCache(videoId: string): CuratedVideo | null {
  const raw = storage.getString(videoId);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.cachedAt > TTL_MS) {
      storage.delete(videoId);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function isVideoCacheStale(videoId: string): boolean {
  const raw = storage.getString(videoId);
  if (!raw) return true;
  try {
    const entry = JSON.parse(raw) as CacheEntry;
    return Date.now() - entry.cachedAt > REVALIDATE_AFTER_MS;
  } catch {
    return true;
  }
}

export function setVideoCache(videoId: string, video: CuratedVideo): void {
  const entry: CacheEntry = { data: video, cachedAt: Date.now() };
  try {
    storage.set(videoId, JSON.stringify(entry));
  } catch {
    // best-effort
  }
}
