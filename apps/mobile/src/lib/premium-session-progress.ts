import type { PremiumSessionStep } from "@inputenglish/shared";
import storage from "@/lib/mmkv";

export type PremiumSessionProgressStatus = "in-progress" | "completed";

export interface PremiumSessionProgress {
  sessionId: string;
  status: PremiumSessionProgressStatus;
  lastStep: PremiumSessionStep;
  savedExpressionCount: number;
  updatedAt: string;
  completedAt: string | null;
}

const KEY_PREFIX = "premium-session-progress-v1:";

function keyForSession(sessionId: string): string {
  return `${KEY_PREFIX}${sessionId}`;
}

function parseProgress(raw: string | undefined): PremiumSessionProgress | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PremiumSessionProgress>;
    if (
      typeof parsed.sessionId !== "string" ||
      (parsed.status !== "in-progress" && parsed.status !== "completed") ||
      typeof parsed.lastStep !== "string"
    ) {
      return null;
    }

    return {
      sessionId: parsed.sessionId,
      status: parsed.status,
      lastStep: parsed.lastStep as PremiumSessionStep,
      savedExpressionCount:
        typeof parsed.savedExpressionCount === "number"
          ? parsed.savedExpressionCount
          : 0,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date(0).toISOString(),
      completedAt:
        typeof parsed.completedAt === "string" ? parsed.completedAt : null,
    };
  } catch {
    return null;
  }
}

export function getPremiumSessionProgress(
  sessionId: string,
): PremiumSessionProgress | null {
  return parseProgress(storage.getString(keyForSession(sessionId)));
}

export function markPremiumSessionInProgress(
  sessionId: string,
  lastStep: PremiumSessionStep,
  now: Date = new Date(),
): PremiumSessionProgress {
  const previous = getPremiumSessionProgress(sessionId);
  if (previous?.status === "completed") return previous;

  const next: PremiumSessionProgress = {
    sessionId,
    status: "in-progress",
    lastStep,
    savedExpressionCount: previous?.savedExpressionCount ?? 0,
    updatedAt: now.toISOString(),
    completedAt: null,
  };
  storage.set(keyForSession(sessionId), JSON.stringify(next));
  return next;
}

export function markPremiumSessionCompleted(
  sessionId: string,
  savedExpressionCount: number,
  now: Date = new Date(),
): PremiumSessionProgress {
  const timestamp = now.toISOString();
  const next: PremiumSessionProgress = {
    sessionId,
    status: "completed",
    lastStep: "completion",
    savedExpressionCount,
    updatedAt: timestamp,
    completedAt: timestamp,
  };
  storage.set(keyForSession(sessionId), JSON.stringify(next));
  return next;
}

export function clearPremiumSessionProgress(sessionId: string): void {
  storage.delete(keyForSession(sessionId));
}
