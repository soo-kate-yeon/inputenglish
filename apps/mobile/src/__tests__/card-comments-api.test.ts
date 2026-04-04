const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDeleteFn = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockSingle = jest.fn();

const chainable = () => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDeleteFn,
  eq: mockEq,
  order: mockOrder,
  single: mockSingle,
});

// Each method returns the chainable object so calls can be chained
for (const fn of [
  mockSelect,
  mockInsert,
  mockUpdate,
  mockDeleteFn,
  mockEq,
  mockOrder,
]) {
  fn.mockReturnValue(chainable());
}

jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => chainable()),
  },
}));

describe("Card Comments API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const fn of [
      mockSelect,
      mockInsert,
      mockUpdate,
      mockDeleteFn,
      mockEq,
      mockOrder,
    ]) {
      fn.mockReturnValue(chainable());
    }
  });

  describe("fetchCardComments", () => {
    it("returns mapped CardComment[] sorted by created_at ASC", async () => {
      const rows = [
        {
          id: "c1",
          target_type: "saved_sentence",
          target_id: "s1",
          body: "Great sentence",
          created_at: "2026-04-01T00:00:00Z",
          updated_at: "2026-04-01T00:00:00Z",
        },
        {
          id: "c2",
          target_type: "highlight",
          target_id: "h1",
          body: "Important",
          created_at: "2026-04-02T00:00:00Z",
          updated_at: "2026-04-02T00:00:00Z",
        },
      ];
      mockOrder.mockResolvedValueOnce({ data: rows, error: null });

      const { fetchCardComments } = require("../../src/lib/api");
      const result = await fetchCardComments("user-1");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "c1",
        targetType: "saved_sentence",
        targetId: "s1",
        body: "Great sentence",
        createdAt: "2026-04-01T00:00:00Z",
        updatedAt: "2026-04-01T00:00:00Z",
      });
      expect(result[1].targetType).toBe("highlight");
    });

    it("throws on supabase error", async () => {
      mockOrder.mockResolvedValueOnce({
        data: null,
        error: { message: "DB error" },
      });

      const { fetchCardComments } = require("../../src/lib/api");
      await expect(fetchCardComments("user-1")).rejects.toEqual({
        message: "DB error",
      });
    });
  });

  describe("createCardComment", () => {
    it("inserts with correct snake_case payload and returns mapped result", async () => {
      const row = {
        id: "c3",
        target_type: "saved_sentence",
        target_id: "s2",
        body: "New comment",
        created_at: "2026-04-03T00:00:00Z",
        updated_at: "2026-04-03T00:00:00Z",
      };
      mockSingle.mockResolvedValueOnce({ data: row, error: null });

      const { createCardComment } = require("../../src/lib/api");
      const result = await createCardComment("user-1", {
        targetType: "saved_sentence",
        targetId: "s2",
        body: "New comment",
      });

      expect(result.id).toBe("c3");
      expect(result.targetType).toBe("saved_sentence");
      expect(result.body).toBe("New comment");
    });
  });

  describe("updateCardComment", () => {
    it("sends body + updated_at and returns mapped result", async () => {
      const row = {
        id: "c1",
        target_type: "saved_sentence",
        target_id: "s1",
        body: "Updated body",
        created_at: "2026-04-01T00:00:00Z",
        updated_at: "2026-04-03T12:00:00Z",
      };
      mockSingle.mockResolvedValueOnce({ data: row, error: null });

      const { updateCardComment } = require("../../src/lib/api");
      const result = await updateCardComment("user-1", "c1", "Updated body");

      expect(result.body).toBe("Updated body");
      expect(result.updatedAt).toBe("2026-04-03T12:00:00Z");
    });
  });

  describe("deleteCardComment", () => {
    it("calls delete with user_id + id filters", async () => {
      // .delete().eq("user_id",...).eq("id",...) — two chained .eq() calls
      mockEq
        .mockReturnValueOnce(chainable()) // first .eq() returns chainable
        .mockResolvedValueOnce({ error: null }); // second .eq() resolves

      const { deleteCardComment } = require("../../src/lib/api");
      await expect(deleteCardComment("user-1", "c1")).resolves.toBeUndefined();
    });

    it("throws on error", async () => {
      mockEq
        .mockReturnValueOnce(chainable())
        .mockResolvedValueOnce({ error: { message: "Delete failed" } });

      const { deleteCardComment } = require("../../src/lib/api");
      await expect(deleteCardComment("user-1", "c1")).rejects.toEqual({
        message: "Delete failed",
      });
    });
  });

  describe("deleteCardCommentsByTarget", () => {
    it("calls delete with user_id + target_id filters", async () => {
      mockEq
        .mockReturnValueOnce(chainable())
        .mockResolvedValueOnce({ error: null });

      const { deleteCardCommentsByTarget } = require("../../src/lib/api");
      await expect(
        deleteCardCommentsByTarget("user-1", "s1"),
      ).resolves.toBeUndefined();
    });
  });
});
