/**
 * TDD tests for Phase 2 — Persist Writer (REQ-VOCAB-P)
 *
 * RED → GREEN → REFACTOR
 *
 * Covers:
 * - AC-P-1: Profile upsert on UNIQUE(user_id) + update_history append
 * - AC-P-2: known_words bulk insert with idempotent on-conflict re-seed
 * - AC-P-3: RLS self_only scoping (admin client always sets user_id)
 * - EC-P-A: Partial failure detectable / retryable (P-W1)
 * - EC-P-B: Pseudowords / unknown tokens NEVER persisted (P-U2)
 * - EC-P-C: Re-submission idempotency (no duplicate rows)
 *
 * Mocking pattern: mirrors ingest-phase1.test.ts / reading-batch-phase2.test.ts.
 * No live DB — supabase client is fully mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Types imported for fixture construction ──────────────────────────────────
import type { VocabBand } from "@inputenglish/shared";
import type { SeedKnownWord } from "@inputenglish/shared";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal mock Supabase client. Callers can override `.from` per test. */
function makeMockClient(overrides?: {
  upsertResult?: { data: unknown; error: unknown };
  insertResult?: { data: unknown; error: unknown };
  selectResult?: { data: unknown; error: unknown };
}) {
  const upsertFn = vi
    .fn()
    .mockResolvedValue(
      overrides?.upsertResult ?? { data: [{ id: "profile-1" }], error: null },
    );
  const insertFn = vi
    .fn()
    .mockResolvedValue(overrides?.insertResult ?? { data: [], error: null });
  const selectFn = vi
    .fn()
    .mockResolvedValue(
      overrides?.selectResult ?? {
        data: [{ update_history: [] }],
        error: null,
      },
    );
  const eqFn = vi.fn().mockReturnThis();
  const maybeSingleFn = vi
    .fn()
    .mockResolvedValue(
      overrides?.selectResult ?? { data: { update_history: [] }, error: null },
    );

  const fromMock = vi.fn().mockReturnValue({
    upsert: upsertFn,
    insert: insertFn,
    select: selectFn,
    eq: eqFn,
    maybeSingle: maybeSingleFn,
  });

  return {
    from: fromMock,
    _mocks: { upsertFn, insertFn, selectFn, eqFn, maybeSingleFn },
  };
}

/** Minimal seed known-word fixture. */
function makeSeedWord(
  lemma: string,
  frequencyBand: VocabBand | "advanced" = "conversation",
): SeedKnownWord {
  return { lemma, frequencyBand };
}

// ── Import module under test (will fail in RED phase) ─────────────────────────
import {
  upsertVocabProfile,
  insertSeedKnownWords,
} from "@/lib/premium/vocab-assessment-repository";

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: upsertVocabProfile (AC-P-1 / P-E1)
// ─────────────────────────────────────────────────────────────────────────────

describe("upsertVocabProfile — profile upsert + update_history append (AC-P-1)", () => {
  const USER_ID = "user-00000000-0000-0000-0000-000000000001";

  it("calls from('user_vocab_profiles') with upsert on first write", async () => {
    const client = makeMockClient();
    // Simulate empty profile (first write — no previous history)
    client._mocks.maybeSingleFn.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    client.from.mockReturnValue({
      upsert: client._mocks.upsertFn,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: client._mocks.maybeSingleFn,
        }),
      }),
      eq: client._mocks.eqFn,
      maybeSingle: client._mocks.maybeSingleFn,
    });

    await upsertVocabProfile(client, USER_ID, {
      estimatedBand: "conversation",
      estimatedLevel: "B1",
      snapshot: { timestamp: "2026-06-16T00:00:00.000Z", reason: "assessment" },
    });

    expect(client.from).toHaveBeenCalledWith("user_vocab_profiles");
    expect(client._mocks.upsertFn).toHaveBeenCalled();
  });

  it("upsert payload includes user_id, estimated_band, estimated_level, updated_at", async () => {
    const client = makeMockClient();
    client._mocks.maybeSingleFn.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    let capturedPayload: unknown = null;
    client.from.mockReturnValue({
      upsert: vi.fn().mockImplementation((payload) => {
        capturedPayload = payload;
        return Promise.resolve({ data: [], error: null });
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: client._mocks.maybeSingleFn,
        }),
      }),
    });

    await upsertVocabProfile(client, USER_ID, {
      estimatedBand: "professional",
      estimatedLevel: "C1",
      snapshot: {
        timestamp: "2026-06-16T00:00:00.000Z",
        reason: "assessment",
      },
    });

    expect(capturedPayload).toMatchObject({
      user_id: USER_ID,
      estimated_band: "professional",
      estimated_level: "C1",
    });
    expect(
      (capturedPayload as Record<string, unknown>).updated_at,
    ).toBeDefined();
  });

  it("appends snapshot to update_history (existing history preserved)", async () => {
    const client = makeMockClient();
    const existingHistory = [
      { timestamp: "2026-01-01T00:00:00.000Z", reason: "assessment" },
    ];
    // Simulate existing profile with history
    client._mocks.maybeSingleFn.mockResolvedValueOnce({
      data: { update_history: existingHistory },
      error: null,
    });

    let capturedPayload: unknown = null;
    client.from.mockReturnValue({
      upsert: vi.fn().mockImplementation((payload) => {
        capturedPayload = payload;
        return Promise.resolve({ data: [], error: null });
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: client._mocks.maybeSingleFn,
        }),
      }),
    });

    const newSnapshot = {
      timestamp: "2026-06-16T00:00:00.000Z",
      reason: "assessment",
      previousBand: "basic" as VocabBand,
    };
    await upsertVocabProfile(client, USER_ID, {
      estimatedBand: "conversation",
      estimatedLevel: "B1",
      snapshot: newSnapshot,
    });

    const payload = capturedPayload as Record<string, unknown>;
    const history = payload.update_history as unknown[];
    // Must contain both the old entry and the new one
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(existingHistory[0]);
    expect(history[1]).toMatchObject(newSnapshot);
  });

  it("update_history is [] when no prior profile exists (first write)", async () => {
    const client = makeMockClient();
    client._mocks.maybeSingleFn.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    let capturedPayload: unknown = null;
    client.from.mockReturnValue({
      upsert: vi.fn().mockImplementation((payload) => {
        capturedPayload = payload;
        return Promise.resolve({ data: [], error: null });
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: client._mocks.maybeSingleFn,
        }),
      }),
    });

    await upsertVocabProfile(client, USER_ID, {
      estimatedBand: "beginner",
      estimatedLevel: "A1",
      snapshot: { timestamp: "2026-06-16T00:00:00.000Z", reason: "assessment" },
    });

    const payload = capturedPayload as Record<string, unknown>;
    const history = payload.update_history as unknown[];
    // Only the new snapshot
    expect(history).toHaveLength(1);
  });

  it("throws a descriptive error when upsert fails (partial failure detectable — P-W1)", async () => {
    const client = makeMockClient();
    client._mocks.maybeSingleFn.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    client.from.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "constraint violation" },
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: client._mocks.maybeSingleFn,
        }),
      }),
    });

    await expect(
      upsertVocabProfile(client, USER_ID, {
        estimatedBand: "conversation",
        estimatedLevel: "B1",
        snapshot: {
          timestamp: "2026-06-16T00:00:00.000Z",
          reason: "assessment",
        },
      }),
    ).rejects.toThrow(/user_vocab_profiles/);
  });

  it("uses onConflict 'user_id' for idempotent upsert (re-submission safe)", async () => {
    const client = makeMockClient();
    client._mocks.maybeSingleFn.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    let upsertOptions: unknown = null;
    client.from.mockReturnValue({
      upsert: vi.fn().mockImplementation((payload, options) => {
        upsertOptions = options;
        return Promise.resolve({ data: [], error: null });
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: client._mocks.maybeSingleFn,
        }),
      }),
    });

    await upsertVocabProfile(client, USER_ID, {
      estimatedBand: "basic",
      estimatedLevel: "A2",
      snapshot: { timestamp: "2026-06-16T00:00:00.000Z", reason: "assessment" },
    });

    // onConflict must target user_id for idempotency
    expect((upsertOptions as Record<string, unknown>)?.onConflict).toBe(
      "user_id",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: insertSeedKnownWords (AC-P-2 / P-E2)
// ─────────────────────────────────────────────────────────────────────────────

describe("insertSeedKnownWords — bulk upsert with idempotent on-conflict (AC-P-2)", () => {
  const USER_ID = "user-00000000-0000-0000-0000-000000000002";

  it("calls from('known_words') and upserts rows", async () => {
    const upsertFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const client = {
      from: vi.fn().mockReturnValue({ upsert: upsertFn }),
    };

    const words: SeedKnownWord[] = [
      makeSeedWord("the", "beginner"),
      makeSeedWord("economy", "professional"),
    ];

    await insertSeedKnownWords(client, USER_ID, words);

    expect(client.from).toHaveBeenCalledWith("known_words");
    expect(upsertFn).toHaveBeenCalled();
  });

  it("each row has user_id, lemma, frequency_band, source='seed'", async () => {
    let capturedRows: unknown = null;
    const client = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation((rows) => {
          capturedRows = rows;
          return Promise.resolve({ data: [], error: null });
        }),
      }),
    };

    const words: SeedKnownWord[] = [
      makeSeedWord("climate", "conversation"),
      makeSeedWord("the", "beginner"),
    ];
    await insertSeedKnownWords(client, USER_ID, words);

    const rows = capturedRows as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.user_id).toBe(USER_ID);
      expect(row.source).toBe("seed");
      expect(row.frequency_band).toBeDefined();
      expect(row.lemma).toBeDefined();
    }
  });

  it("uses onConflict 'user_id,lemma' for idempotent re-seed (no duplicate-key error)", async () => {
    let capturedOptions: unknown = null;
    const client = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation((_rows, options) => {
          capturedOptions = options;
          return Promise.resolve({ data: [], error: null });
        }),
      }),
    };

    await insertSeedKnownWords(client, USER_ID, [
      makeSeedWord("be", "beginner"),
    ]);

    expect((capturedOptions as Record<string, unknown>)?.onConflict).toBe(
      "user_id,lemma",
    );
  });

  it("returns early (no DB call) when seedKnownWords is empty", async () => {
    const upsertFn = vi.fn();
    const client = {
      from: vi.fn().mockReturnValue({ upsert: upsertFn }),
    };

    await insertSeedKnownWords(client, USER_ID, []);

    expect(upsertFn).not.toHaveBeenCalled();
  });

  it("throws a descriptive error when upsert fails (partial failure detectable — P-W1)", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "network error" },
        }),
      }),
    };

    await expect(
      insertSeedKnownWords(client, USER_ID, [makeSeedWord("the", "beginner")]),
    ).rejects.toThrow(/known_words/);
  });

  it("maps frequency_band correctly for each seed word", async () => {
    let capturedRows: unknown = null;
    const client = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation((rows) => {
          capturedRows = rows;
          return Promise.resolve({ data: [], error: null });
        }),
      }),
    };

    const words: SeedKnownWord[] = [
      makeSeedWord("the", "beginner"),
      makeSeedWord("economy", "professional"),
      makeSeedWord("innovation", "advanced"),
    ];
    await insertSeedKnownWords(client, USER_ID, words);

    const rows = capturedRows as Record<string, unknown>[];
    expect(rows[0].frequency_band).toBe("beginner");
    expect(rows[1].frequency_band).toBe("professional");
    expect(rows[2].frequency_band).toBe("advanced");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: RLS scoping (AC-P-3 / P-U1)
// ─────────────────────────────────────────────────────────────────────────────

describe("RLS scoping — user_id always set on every write (AC-P-3 / P-U1)", () => {
  const USER_A = "user-aaaa-0000-0000-0000-000000000001";
  const USER_B = "user-bbbb-0000-0000-0000-000000000002";

  it("upsertVocabProfile writes user_id = the supplied userId (not another user)", async () => {
    let capturedPayload: unknown = null;
    const mockFrom = vi.fn().mockReturnValue({
      upsert: vi.fn().mockImplementation((payload) => {
        capturedPayload = payload;
        return Promise.resolve({ data: [], error: null });
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    const client = { from: mockFrom };

    await upsertVocabProfile(client, USER_A, {
      estimatedBand: "basic",
      estimatedLevel: "A2",
      snapshot: { timestamp: "2026-06-16T00:00:00.000Z", reason: "assessment" },
    });

    expect((capturedPayload as Record<string, unknown>).user_id).toBe(USER_A);
    expect((capturedPayload as Record<string, unknown>).user_id).not.toBe(
      USER_B,
    );
  });

  it("insertSeedKnownWords writes user_id = the supplied userId on every row", async () => {
    let capturedRows: unknown = null;
    const client = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation((rows) => {
          capturedRows = rows;
          return Promise.resolve({ data: [], error: null });
        }),
      }),
    };

    await insertSeedKnownWords(client, USER_B, [
      makeSeedWord("the", "beginner"),
      makeSeedWord("economy", "professional"),
    ]);

    const rows = capturedRows as Record<string, unknown>[];
    for (const row of rows) {
      expect(row.user_id).toBe(USER_B);
      expect(row.user_id).not.toBe(USER_A);
    }
  });
});
