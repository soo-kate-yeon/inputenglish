// @MX:NOTE: MMKV-backed transcript cache with 7-day TTL and 50MB LRU eviction
// @MX:SPEC: SPEC-MOBILE-007 - offline transcript cache
import { MMKV } from "react-native-mmkv";

const storage = new MMKV({ id: "transcript-cache" });
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_BYTES = 50 * 1024 * 1024; // 50MB

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

function byteSize(str: string): number {
  return str.length * 2; // UTF-16 approximation
}

function evictLRU(requiredBytes: number): void {
  const keys = storage.getAllKeys();
  const entries = keys
    .map((key) => {
      const raw = storage.getString(key);
      if (!raw) return null;
      try {
        const entry = JSON.parse(raw) as CacheEntry<unknown>;
        return { key, cachedAt: entry.cachedAt, size: byteSize(raw) };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as { key: string; cachedAt: number; size: number }[];

  entries.sort((a, b) => a.cachedAt - b.cachedAt);

  let freed = 0;
  for (const entry of entries) {
    if (freed >= requiredBytes) break;
    storage.delete(entry.key);
    freed += entry.size;
  }
}

export function setCache<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, cachedAt: Date.now() };
  const serialized = JSON.stringify(entry);
  const size = byteSize(serialized);

  const totalSize = storage
    .getAllKeys()
    .reduce((sum, k) => sum + byteSize(storage.getString(k) ?? ""), 0);

  if (totalSize + size > MAX_BYTES) {
    evictLRU(size);
  }

  storage.set(key, serialized);
}

export function getCache<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.cachedAt > TTL_MS) {
      storage.delete(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function deleteCache(key: string): void {
  storage.delete(key);
}

export function clearCache(): void {
  storage.getAllKeys().forEach((k) => storage.delete(k));
}
