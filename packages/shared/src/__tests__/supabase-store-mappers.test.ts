// RED phase: Tests for the 3 new mapper functions in supabase-store.ts
import {
  mapVocabProfileRow,
  mapKnownWordRow,
  mapAskedItemRow,
} from "../lib/supabase-store";

describe("mapVocabProfileRow", () => {
  it("maps snake_case DB row to camelCase UserVocabProfile", () => {
    const row = {
      id: "profile-uuid-1",
      user_id: "user-uuid-1",
      estimated_band: "basic",
      estimated_level: "A2",
      update_history: [
        { timestamp: "2026-01-01T00:00:00Z", reason: "onboarding" },
      ],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    const result = mapVocabProfileRow(row);

    expect(result.id).toBe("profile-uuid-1");
    expect(result.userId).toBe("user-uuid-1");
    expect(result.estimatedBand).toBe("basic");
    expect(result.estimatedLevel).toBe("A2");
    expect(result.updateHistory).toHaveLength(1);
    expect(result.createdAt).toBe("2026-01-01T00:00:00Z");
    expect(result.updatedAt).toBe("2026-01-02T00:00:00Z");
  });

  it("defaults updateHistory to empty array when null", () => {
    const row = {
      id: "profile-uuid-2",
      user_id: "user-uuid-2",
      estimated_band: "conversation",
      estimated_level: "B1",
      update_history: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const result = mapVocabProfileRow(row);

    expect(result.updateHistory).toEqual([]);
  });
});

describe("mapKnownWordRow", () => {
  it("maps snake_case DB row to camelCase KnownWord", () => {
    const row = {
      id: "word-uuid-1",
      user_id: "user-uuid-1",
      lemma: "knowledge",
      frequency_band: "conversation",
      source: "seed",
      last_seen: "2026-06-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
    };

    const result = mapKnownWordRow(row);

    expect(result.id).toBe("word-uuid-1");
    expect(result.userId).toBe("user-uuid-1");
    expect(result.lemma).toBe("knowledge");
    expect(result.frequencyBand).toBe("conversation");
    expect(result.source).toBe("seed");
    expect(result.lastSeen).toBe("2026-06-01T00:00:00Z");
    expect(result.createdAt).toBe("2026-01-01T00:00:00Z");
  });

  it("handles null last_seen", () => {
    const row = {
      id: "word-uuid-2",
      user_id: "user-uuid-1",
      lemma: "hello",
      frequency_band: "beginner",
      source: "tap",
      last_seen: null,
      created_at: "2026-01-01T00:00:00Z",
    };

    const result = mapKnownWordRow(row);

    expect(result.lastSeen).toBeNull();
  });

  it("maps advanced frequency_band correctly", () => {
    const row = {
      id: "word-uuid-3",
      user_id: "user-uuid-1",
      lemma: "exacerbate",
      frequency_band: "advanced",
      source: "inferred",
      last_seen: null,
      created_at: "2026-01-01T00:00:00Z",
    };

    const result = mapKnownWordRow(row);

    expect(result.frequencyBand).toBe("advanced");
    expect(result.source).toBe("inferred");
  });
});

describe("mapAskedItemRow", () => {
  it("maps snake_case DB row to camelCase AskedItem", () => {
    const row = {
      id: "asked-uuid-1",
      user_id: "user-uuid-1",
      source_type: "reading",
      source_ref: { type: "reading", pieceId: "piece-uuid-1" },
      highlight_text: "the quick brown fox",
      question: "What does this idiom mean?",
      answer: "It means to be fast and agile.",
      created_at: "2026-06-01T00:00:00Z",
    };

    const result = mapAskedItemRow(row);

    expect(result.id).toBe("asked-uuid-1");
    expect(result.userId).toBe("user-uuid-1");
    expect(result.sourceType).toBe("reading");
    expect(result.sourceRef).toEqual({
      type: "reading",
      pieceId: "piece-uuid-1",
    });
    expect(result.highlightText).toBe("the quick brown fox");
    expect(result.question).toBe("What does this idiom mean?");
    expect(result.answer).toBe("It means to be fast and agile.");
    expect(result.createdAt).toBe("2026-06-01T00:00:00Z");
  });

  it("handles null question and answer", () => {
    const row = {
      id: "asked-uuid-2",
      user_id: "user-uuid-1",
      source_type: "segment",
      source_ref: { type: "segment", pieceId: "seg-uuid-1" },
      highlight_text: "some text",
      question: null,
      answer: null,
      created_at: "2026-06-01T00:00:00Z",
    };

    const result = mapAskedItemRow(row);

    expect(result.question).toBeNull();
    expect(result.answer).toBeNull();
  });
});
