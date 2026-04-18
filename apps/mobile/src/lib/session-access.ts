import type { Href } from "expo-router";
import type { SessionListItem } from "./api";
import type { Plan } from "./revenue-cat";

type SessionAccessTarget = Pick<
  SessionListItem,
  "id" | "source_video_id" | "premium_required"
>;

export function getSessionPressDestination(
  session: SessionAccessTarget,
  plan: Plan,
): Href {
  if (session.premium_required && plan === "FREE") {
    return "/paywall";
  }

  return `/study/${session.source_video_id}?sessionId=${session.id}` as Href;
}
