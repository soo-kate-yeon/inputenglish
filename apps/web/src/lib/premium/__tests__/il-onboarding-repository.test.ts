/**
 * TDD tests for il-onboarding-repository (Task 3.1/3.2/3.3, SPEC-WEB-001 Phase 3).
 *
 * RED -> GREEN -> REFACTOR
 *
 * Single writer for users.il_index / vocab_estimate / selected_course during onboarding.
 * Mirrors vocab-assessment-repository.ts: explicit user_id scoping, admin client, throws
 * descriptive errors on failure so callers can surface retryable errors.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  writeIlSeed,
  finalizeIlIndex,
  writeSelectedCourse,
  clampIlIndex,
} from "../il-onboarding-repository";

function makeClient(overrides?: { updateError?: unknown }) {
  const eq = vi
    .fn()
    .mockResolvedValue({ error: overrides?.updateError ?? null });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { from, update, eq };
}

describe("clampIlIndex", () => {
  it("clamps values below 1.0 to 1.0", () => {
    expect(clampIlIndex(0.3)).toBe(1.0);
    expect(clampIlIndex(-5)).toBe(1.0);
  });

  it("clamps values above 7.0 to 7.0", () => {
    expect(clampIlIndex(9.5)).toBe(7.0);
  });

  it("leaves in-range values unchanged", () => {
    expect(clampIlIndex(4.2)).toBe(4.2);
    expect(clampIlIndex(1.0)).toBe(1.0);
    expect(clampIlIndex(7.0)).toBe(7.0);
  });
});

describe("writeIlSeed", () => {
  let client: ReturnType<typeof makeClient>;

  beforeEach(() => {
    client = makeClient();
  });

  it("writes the clamped IL seed onto users.il_index", async () => {
    await writeIlSeed(client, "user-1", 4.0);

    expect(client.from).toHaveBeenCalledWith("users");
    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({ il_index: 4.0 }),
    );
    expect(client.eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("clamps out-of-range seeds before writing", async () => {
    await writeIlSeed(client, "user-1", 9.0);
    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({ il_index: 7.0 }),
    );
  });

  it("throws a descriptive error when the update fails", async () => {
    client = makeClient({ updateError: { message: "db down" } });
    await expect(writeIlSeed(client, "user-1", 4.0)).rejects.toThrow(/db down/);
  });
});

describe("finalizeIlIndex", () => {
  let client: ReturnType<typeof makeClient>;

  beforeEach(() => {
    client = makeClient();
  });

  it("uses the lower of selfReportIl and diagnosticIl (EC-002-B invariant)", async () => {
    const result = await finalizeIlIndex(client, "user-1", {
      selfReportIl: 5.0,
      diagnosticIl: 3.0,
    });

    expect(result.finalIl).toBe(3.0);
    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({ il_index: 3.0 }),
    );
  });

  it("uses selfReportIl when it is lower than or equal to diagnosticIl", async () => {
    const result = await finalizeIlIndex(client, "user-1", {
      selfReportIl: 2.0,
      diagnosticIl: 5.0,
    });

    expect(result.finalIl).toBe(2.0);
  });

  it("NEVER starts higher than the diagnostic estimate when they disagree (EC-002-B)", async () => {
    const result = await finalizeIlIndex(client, "user-1", {
      selfReportIl: 7.0,
      diagnosticIl: 1.0,
    });

    expect(result.finalIl).toBeLessThanOrEqual(1.0);
    expect(result.finalIl).toBe(1.0);
  });

  it("clamps the final value into [1.0, 7.0]", async () => {
    const result = await finalizeIlIndex(client, "user-1", {
      selfReportIl: 0.1,
      diagnosticIl: 0.2,
    });
    expect(result.finalIl).toBeGreaterThanOrEqual(1.0);
  });

  it("persists vocabEstimate alongside il_index when provided", async () => {
    await finalizeIlIndex(client, "user-1", {
      selfReportIl: 3.0,
      diagnosticIl: 3.0,
      vocabEstimate: 1800,
    });

    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({ il_index: 3.0, vocab_estimate: 1800 }),
    );
  });

  it("throws a descriptive error when the update fails", async () => {
    client = makeClient({ updateError: { message: "conflict" } });
    await expect(
      finalizeIlIndex(client, "user-1", { selfReportIl: 3, diagnosticIl: 3 }),
    ).rejects.toThrow(/conflict/);
  });
});

describe("writeSelectedCourse", () => {
  it("writes the fixed course identifier onto users.selected_course", async () => {
    const client = makeClient();
    await writeSelectedCourse(client, "user-1", "news");

    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({ selected_course: "news" }),
    );
    expect(client.eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("throws a descriptive error when the update fails", async () => {
    const client = makeClient({ updateError: { message: "nope" } });
    await expect(writeSelectedCourse(client, "user-1", "news")).rejects.toThrow(
      /nope/,
    );
  });
});
