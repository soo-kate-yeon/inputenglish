import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteIn = vi.fn(() => Promise.resolve({ error: null }));
const deleteEq = vi.fn(() => Promise.resolve({ error: null }));
const selectEq = vi.fn(() => Promise.resolve({ data: [{ id: "existing-1" }] }));
const upsertSelect = vi.fn(() => Promise.resolve({ error: null }));
const contextUpsert = vi.fn(() => Promise.resolve({ error: null }));

const adminClient = {
  from: vi.fn((table: string) => {
    if (table === "learning_sessions") {
      return {
        select: vi.fn(() => ({
          eq: selectEq,
        })),
        delete: vi.fn(() => ({
          in: deleteIn,
        })),
        upsert: vi.fn(() => ({
          select: upsertSelect,
        })),
      };
    }

    if (table === "session_contexts") {
      return {
        delete: vi.fn(() => ({
          in: deleteIn,
        })),
        upsert: contextUpsert,
      };
    }

    throw new Error(`Unexpected table ${table}`);
  }),
};

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: vi.fn(() => adminClient),
}));

describe("POST /api/admin/learning-sessions", () => {
  beforeEach(() => {
    adminClient.from.mockClear();
    deleteIn.mockClear();
    deleteEq.mockClear();
    selectEq.mockClear();
    upsertSelect.mockClear();
    contextUpsert.mockClear();
  });

  it("persists professional metadata and context payloads", async () => {
    const { POST } = await import("./learning-sessions/route");
    const response = await POST(
      new Request("http://localhost/api/admin/learning-sessions", {
        method: "POST",
        body: JSON.stringify({
          source_video_id: "video-1",
          sessions: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              source_video_id: "video-1",
              title: "데모로 배우는 지표 설명하는 법",
              description: "설명 흐름을 연습해요.",
              start_time: 0,
              end_time: 12,
              sentence_ids: ["s1", "s2"],
              difficulty: "intermediate",
              order_index: 0,
              source_type: "demo",
              speaking_function: "explain-metric",
              role_relevance: ["pm", "engineer"],
              premium_required: true,
              context: {
                strategic_intent: "수치를 해석해 의미를 부여한다.",
                speaking_function: "explain-metric",
                reusable_scenarios: ["주간 공유"],
                key_vocabulary: ["momentum"],
                grammar_rhetoric_note: "관찰 기반 설명",
                expected_takeaway: "지표를 설명할 수 있다.",
                generated_by: "gemini",
              },
            },
          ],
        }),
      }) as never,
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(upsertSelect).toHaveBeenCalledTimes(1);
    expect(contextUpsert).toHaveBeenCalledWith([
      expect.objectContaining({
        session_id: "11111111-1111-4111-8111-111111111111",
        speaking_function: "explain-metric",
        reusable_scenarios: ["주간 공유"],
        key_vocabulary: ["momentum"],
      }),
    ]);
  });
});
