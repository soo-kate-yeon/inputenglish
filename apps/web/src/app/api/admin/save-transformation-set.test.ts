/**
 * TDD: SPEC-MOBILE-011 - save-transformation-set API route tests
 * RED phase: define expected behavior before implementation
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "transformation_sets") {
        return {
          insert: mockInsert,
          select: mockSelect,
          eq: mockEq,
        };
      }
      if (table === "transformation_exercises") {
        return {
          insert: mockInsert,
          select: mockSelect,
        };
      }
      return { insert: mockInsert, select: mockSelect };
    }),
  })),
}));

describe("POST /api/admin/save-transformation-set", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    vi.clearAllMocks();
  });

  it("saves transformation set and exercises, returns saved set id", async () => {
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "set-saved-1",
            session_id: "session-1",
            target_pattern: "declarative explanation",
            pattern_type: "declarative",
            generated_by: "ai",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
          error: null,
        }),
      }),
    });

    const { POST } = await import("./save-transformation-set/route");
    const response = await POST(
      new Request("http://localhost/api/admin/save-transformation-set", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "session-1",
          set: {
            target_pattern: "declarative explanation",
            pattern_type: "declarative",
          },
          exercises: [
            {
              page_order: 2,
              exercise_type: "kr-to-en",
              instruction_text: "Translate.",
              source_korean: "매출이 증가했습니다.",
            },
          ],
        }),
      }) as never,
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.setId).toBe("set-saved-1");
  });

  it("returns 400 when required fields missing", async () => {
    const { POST } = await import("./save-transformation-set/route");
    const response = await POST(
      new Request("http://localhost/api/admin/save-transformation-set", {
        method: "POST",
        body: JSON.stringify({ sessionId: "session-1" }),
      }) as never,
    );

    expect(response.status).toBe(400);
  });
});
