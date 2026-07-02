/**
 * SPEC-WEB-001 Phase 5 — Task 5.5: daily question cap (D15, REQ-WEB-004-W2/U4).
 * Mirrors question-cap.ts's shape (getMonthlyQuestionCount/getCapStatus) but
 * daily/10 using the daily_question_counts table, NOT the existing monthly
 * cap (question-cap.ts, INVIOLABLE KEEP, untouched — SPEC-INPUT-001).
 */
import { describe, it, expect, vi } from "vitest";
import {
  DAILY_QUESTION_CAP,
  getDailyQuestionCount,
  getDailyCapStatus,
  incrementDailyQuestionCount,
} from "../daily-question-cap";

describe("daily-question-cap", () => {
  describe("DAILY_QUESTION_CAP", () => {
    it("is 10 (D15: hard-coded daily cap per content)", () => {
      expect(DAILY_QUESTION_CAP).toBe(10);
    });
  });

  describe("getDailyCapStatus", () => {
    it("returns no notice when well under cap", () => {
      const result = getDailyCapStatus(3);
      expect(result.remaining).toBe(7);
      expect(result.isExceeded).toBe(false);
      expect(result.notice).toBeUndefined();
    });

    it("returns positive-framing notice at 9 used (1 remaining) — AC-004-3", () => {
      const result = getDailyCapStatus(9);
      expect(result.remaining).toBe(1);
      expect(result.isExceeded).toBe(false);
      expect(result.notice).toBe("오늘 질문 1개 남음");
    });

    it("is a soft cap at exactly 10 used — NOT exceeded, still allowed with 0 remaining (D15: never hard-block until the 11th)", () => {
      const result = getDailyCapStatus(10);
      expect(result.remaining).toBe(0);
    });

    it("is exceeded (soft-fail territory) at 11 used — EC-004-B", () => {
      const result = getDailyCapStatus(11);
      expect(result.isExceeded).toBe(true);
      expect(result.notice).toContain("내일");
    });

    it("never returns a hard-block notice — exceeded notice mentions tomorrow/reset, not a rejection", () => {
      const result = getDailyCapStatus(15);
      expect(result.notice).not.toMatch(/차단|불가/);
    });
  });

  describe("getDailyQuestionCount", () => {
    it("returns 0 when no row exists for today", async () => {
      const maybeSingle = vi
        .fn()
        .mockResolvedValue({ data: null, error: null });
      const supabase = {
        from: () => ({
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle }) }),
          }),
        }),
      };

      const count = await getDailyQuestionCount(supabase as never, "user-1");
      expect(count).toBe(0);
    });

    it("returns the count from today's row when it exists", async () => {
      const maybeSingle = vi
        .fn()
        .mockResolvedValue({ data: { count: 7 }, error: null });
      const supabase = {
        from: () => ({
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle }) }),
          }),
        }),
      };

      const count = await getDailyQuestionCount(supabase as never, "user-1");
      expect(count).toBe(7);
    });
  });

  describe("incrementDailyQuestionCount", () => {
    it("upserts today's row using the caller-provided currentCount, incrementing by 1 (no internal re-fetch)", async () => {
      const upsert = vi.fn().mockReturnValue({
        select: () => ({
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: { count: 4 }, error: null }),
        }),
      });
      const select = vi.fn();
      const supabase = {
        from: () => ({
          select,
          upsert,
        }),
      };

      const newCount = await incrementDailyQuestionCount(
        supabase as never,
        "user-1",
        3,
      );

      expect(newCount).toBe(4);
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({ count: 4 }),
        expect.anything(),
      );
      // No internal getDailyQuestionCount lookup — currentCount came from the caller.
      expect(select).not.toHaveBeenCalled();
    });
  });
});
