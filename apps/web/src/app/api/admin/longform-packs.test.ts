import { beforeEach, describe, expect, it, vi } from "vitest";

const longformUpsertSingle = vi.fn(() =>
  Promise.resolve({ data: { id: "pack-1" }, error: null }),
);
const longformContextUpsert = vi.fn(() => Promise.resolve({ error: null }));

vi.mock("@/utils/supabase/admin-auth", () => ({
  requireAdmin: vi.fn(async () => ({
    id: "admin-user",
    email: "admin@example.com",
  })),
}));

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "longform_packs") {
        return {
          upsert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: longformUpsertSingle,
            })),
          })),
        };
      }

      if (table === "longform_contexts") {
        return {
          upsert: longformContextUpsert,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  })),
}));

describe("POST /api/admin/longform-packs", () => {
  beforeEach(() => {
    longformUpsertSingle.mockClear();
    longformContextUpsert.mockClear();
  });

  it("saves a longform pack and optional context", async () => {
    const { POST } = await import("./longform-packs/route");
    const response = await POST(
      new Request("http://localhost/api/admin/longform-packs", {
        method: "POST",
        body: JSON.stringify({
          source_video_id: "video-1",
          longformPack: {
            id: "11111111-1111-4111-8111-111111111111",
            source_video_id: "video-1",
            title: "창업자 대담 롱폼",
            subtitle: "핵심 철학이 이어지는 구간이에요.",
            description: "창업 철학과 팀 운영 얘기가 묶이는 긴 구간이에요.",
            duration: 1500,
            sentence_ids: ["s1", "s2"],
            start_time: 0,
            end_time: 1500,
            topic_tags: ["제품 철학"],
            content_tags: ["podcast"],
            created_at: new Date().toISOString(),
            context: {
              speaker_snapshot: "제품 철학을 차분하게 설명하는 화자",
              conversation_type: "팟캐스트 인터뷰",
              core_topics: ["제품 철학", "채용"],
              why_this_segment: "주제가 가장 응집된 구간이에요.",
              listening_takeaway: "긴 답변을 구조적으로 듣는 감각을 얻어요.",
            },
          },
        }),
      }) as never,
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.longform_pack_id).toBe("pack-1");
    expect(longformContextUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        longform_pack_id: "pack-1",
        conversation_type: "팟캐스트 인터뷰",
      }),
    );
  });
});
