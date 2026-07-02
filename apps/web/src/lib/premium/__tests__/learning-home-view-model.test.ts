/**
 * SPEC-WEB-001 Phase 5 — Task 5.2: learning home view-model.
 *
 * Pure mapping from a `/api/premium/today` fetch outcome (entitlement gate
 * response OR session response) into a discriminated view-model the
 * `/learning` page renders. Kept pure/testable per this repo's convention
 * (no React rendering harness exists yet — see OnboardingFlow/post-json.ts).
 *
 * AC-004-1 / AC-005-2: on 402 (entitlement gate), show a subscribe/upgrade
 * prompt; on success, show the day's session (reading=script_clean + N segments).
 */
import { describe, expect, it } from "vitest";
import {
  buildLearningHomeViewModel,
  type TodayApiResult,
} from "../learning-home-view-model";

describe("buildLearningHomeViewModel", () => {
  it("maps a 402 entitlement-gated response to an 'upgrade-required' view (AC-005-2)", () => {
    const result: TodayApiResult = {
      status: 402,
      body: {
        entitlement: {
          hasAccess: false,
          plan: "FREE",
          reason: "trial-expired",
          trialEndsAt: "2026-06-01T00:00:00.000Z",
          subscriptionExpiresAt: null,
        },
        session: null,
      },
    };

    const vm = buildLearningHomeViewModel(result);

    expect(vm.kind).toBe("upgrade-required");
  });

  it("maps a preparing session (status='preparing') to a 'preparing' view, not 'ready' (EC-005-A)", () => {
    const result: TodayApiResult = {
      status: 200,
      body: {
        session: {
          id: "preparing-1",
          date: "2026-07-03",
          readingPiece: null,
          segments: [],
          assemblyMeta: { status: "preparing" },
        },
        remainingQuestionCap: 10,
      },
    };

    const vm = buildLearningHomeViewModel(result);

    expect(vm.kind).toBe("preparing");
  });

  it("maps a ready session with a reading piece + segments to a 'ready' view (AC-004-1)", () => {
    const result: TodayApiResult = {
      status: 200,
      body: {
        session: {
          id: "ci-1",
          date: "2026-07-03",
          readingPiece: {
            id: "reading-1",
            level: "B1",
            format: "editorial",
            topic: "news",
            body: "clean script body",
            coveragePct: 95,
            validationStatus: "approved",
            sourceFacts: {},
            userId: null,
            createdAt: "2026-07-01T00:00:00.000Z",
          },
          segments: [
            {
              id: "seg-1",
              parentVideoId: "yt-1",
              channelId: "ch-1",
              startTime: 0,
              endTime: 60,
              transcript: [],
              wpm: 150,
              bandCoverage: {
                beginner: 0.9,
                basic: 0.94,
                conversation: 0.965,
                professional: 0.97,
              },
              topicTags: [],
              selfContained: true,
              difficultyScore: 3,
              createdAt: "2026-07-01T00:00:00.000Z",
            },
          ],
          assemblyMeta: { status: "ready" },
        },
        remainingQuestionCap: 9,
      },
    };

    const vm = buildLearningHomeViewModel(result);

    expect(vm.kind).toBe("ready");
    if (vm.kind === "ready") {
      expect(vm.segments).toHaveLength(1);
      expect(vm.remainingQuestionCap).toBe(9);
    }
  });

  it("maps an unexpected/error status to an 'error' view", () => {
    const result: TodayApiResult = {
      status: 500,
      body: { error: "boom" },
    };

    const vm = buildLearningHomeViewModel(result);

    expect(vm.kind).toBe("error");
  });
});
