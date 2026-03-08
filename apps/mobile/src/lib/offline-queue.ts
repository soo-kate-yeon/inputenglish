// @MX:NOTE: MMKV-backed FIFO offline queue with retry logic
// @MX:SPEC: SPEC-MOBILE-007 - offline queue for deferred Supabase writes
import { MMKV } from "react-native-mmkv";

const storage = new MMKV({ id: "offline-queue" });
const QUEUE_KEY = "offline_queue";
const MAX_RETRIES = 3;

export interface QueueItem {
  id: string;
  type: string;
  payload: unknown;
  retries: number;
  createdAt: number;
}

function readQueue(): QueueItem[] {
  const raw = storage.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueueItem[];
  } catch {
    return [];
  }
}

function writeQueue(items: QueueItem[]): void {
  storage.set(QUEUE_KEY, JSON.stringify(items));
}

export function enqueue(type: string, payload: unknown): QueueItem {
  const item: QueueItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    payload,
    retries: 0,
    createdAt: Date.now(),
  };
  const queue = readQueue();
  queue.push(item);
  writeQueue(queue);
  return item;
}

export function dequeue(): QueueItem | null {
  const queue = readQueue();
  const item = queue.shift() ?? null;
  if (item) writeQueue(queue);
  return item;
}

export function getAll(): QueueItem[] {
  return readQueue();
}

export function remove(id: string): void {
  writeQueue(readQueue().filter((i) => i.id !== id));
}

export function markFailed(id: string): void {
  const queue = readQueue();
  const item = queue.find((i) => i.id === id);
  if (!item) return;
  item.retries += 1;
  if (item.retries >= MAX_RETRIES) {
    writeQueue(queue.filter((i) => i.id !== id));
  } else {
    writeQueue(queue);
  }
}

export function clear(): void {
  storage.delete(QUEUE_KEY);
}
