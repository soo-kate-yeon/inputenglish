import { describe, expect, it } from "vitest";
import type { LearningProfile, PremiumSession } from "@inputenglish/shared";
import {
  scorePremiumSessionForProfile,
  selectDailyPremiumSession,
} from "@inputenglish/shared";

const profile: LearningProfile = {
  user_id: "user-1",
  level_band: "professional",
  goal_mode: "expression",
  focus_tags: ["leadership", "school-work"],
  preferred_speakers: ["Jonny Kim"],
  preferred_situations: ["school-work", "presentation-meeting"],
  preferred_source_types: ["public-speech", "keynote"],
  preferred_genres: ["business"],
  onboarding_completed_at: "2026-06-10T00:00:00.000Z",
  updated_at: "2026-06-10T00:00:00.000Z",
};

function premiumSession(
  overrides: Partial<PremiumSession> & { id: string },
): PremiumSession {
  const { id, ...rest } = overrides;
  return {
    id,
    source_video_id: "video-1",
    source_url: "https://www.youtube.com/watch?v=video-1",
    title: "Premium session",
    subtitle: null,
    description: null,
    thumbnail_url: null,
    channel_name: "InputEnglish",
    speaker_name: null,
    source_type: "interview",
    genre: "entertainment",
    speaking_situations: ["daily-chat"],
    interest_tags: ["culture"],
    difficulty_level: 2,
    duration_seconds: 300,
    segment_start_time: 0,
    segment_end_time: 180,
    transcript: [],
    article: {
      title: "Article",
      body: "Article body",
      reviewed: true,
    },
    delivery_analysis: [],
    expression_cards: [],
    roleplay: {
      title: "Roleplay",
      situation: "Meeting",
      user_role: "Learner",
      partner_role: "Coach",
      turns: [],
      target_expression_ids: [],
      reviewed: true,
    },
    status: "published",
    reviewed: true,
    published_on: "2026-06-14",
    published_at: "2026-06-14T00:00:00.000Z",
    created_at: "2026-06-14T00:00:00.000Z",
    updated_at: "2026-06-14T00:00:00.000Z",
    ...rest,
  };
}

describe("premium curation scoring", () => {
  it("scores published sessions against every onboarding interest field", () => {
    const matched = premiumSession({
      id: "matched-session",
      speaker_name: "jonny kim",
      source_type: "public-speech",
      genre: "business",
      speaking_situations: ["school-work", "presentation-meeting"],
      interest_tags: ["leadership"],
      difficulty_level: 4,
    });
    const generic = premiumSession({
      id: "generic-session",
      speaker_name: "Other speaker",
      source_type: "talk-show",
      genre: "entertainment",
      speaking_situations: ["daily-chat"],
      interest_tags: ["culture"],
      difficulty_level: 1,
    });

    expect(scorePremiumSessionForProfile(matched, profile)).toBeGreaterThan(
      scorePremiumSessionForProfile(generic, profile),
    );
  });

  it("selects the best matching published session over the newest weak match", () => {
    const newestWeakMatch = premiumSession({
      id: "newest-weak-match",
      published_on: "2026-06-14",
      source_type: "talk-show",
      genre: "entertainment",
      speaking_situations: ["daily-chat"],
      interest_tags: ["culture"],
    });
    const olderStrongMatch = premiumSession({
      id: "older-strong-match",
      published_on: "2026-06-12",
      speaker_name: "Jonny Kim",
      source_type: "public-speech",
      genre: "business",
      speaking_situations: ["school-work"],
      interest_tags: ["leadership"],
      difficulty_level: 4,
    });

    expect(
      selectDailyPremiumSession([newestWeakMatch, olderStrongMatch], profile)
        ?.id,
    ).toBe("older-strong-match");
  });

  it("ignores draft sessions and uses published_on as the tie breaker", () => {
    const draftMatch = premiumSession({
      id: "draft-match",
      status: "draft",
      published_on: "2026-06-15",
      source_type: "public-speech",
      genre: "business",
      speaking_situations: ["school-work"],
      interest_tags: ["leadership"],
    });
    const olderPublished = premiumSession({
      id: "older-published",
      published_on: "2026-06-12",
    });
    const newerPublished = premiumSession({
      id: "newer-published",
      published_on: "2026-06-14",
    });

    expect(
      selectDailyPremiumSession(
        [draftMatch, olderPublished, newerPublished],
        profile,
      )?.id,
    ).toBe("newer-published");
  });
});
