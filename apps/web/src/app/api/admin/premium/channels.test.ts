import { beforeEach, describe, expect, it, vi } from "vitest";

const insertSingle = vi.fn();
const selectOrder = vi.fn();

vi.mock("@/utils/supabase/admin-auth", () => ({
  requireAdmin: vi.fn(async () => ({
    id: "admin-user",
    email: "admin@example.com",
  })),
}));

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "channels") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: insertSingle,
            })),
          })),
          select: vi.fn(() => ({
            order: selectOrder,
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  })),
}));

function postRequest(body: unknown) {
  return new Request("http://localhost/api/admin/premium/channels", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/admin/premium/channels (REQ-WEB-003-U1, Task 4.1)", () => {
  beforeEach(() => {
    insertSingle.mockReset();
    selectOrder.mockReset();
  });

  it("creates an official whitelist channel entry", async () => {
    insertSingle.mockResolvedValue({
      data: {
        id: "channel-1",
        name: "BBC Learning English",
        youtube_channel_id: "UC-bbc",
        level_band: "conversation",
        visual_accent_tags: ["standard-accent"],
        topics: ["news"],
        active: true,
        legal_status: "official",
      },
      error: null,
    });

    const { POST } = await import("./channels/route");
    const response = await POST(
      postRequest({
        name: "BBC Learning English",
        youtubeChannelId: "UC-bbc",
        levelBand: "conversation",
        visualAccentTags: ["standard-accent"],
        topics: ["news"],
        legalStatus: "official",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.channel).toMatchObject({
      id: "channel-1",
      name: "BBC Learning English",
      legalStatus: "official",
    });
  });

  it("rejects an unofficial reupload channel at creation time (AC-003-2, 400)", async () => {
    const { POST } = await import("./channels/route");
    const response = await POST(
      postRequest({
        name: "Peppa Pig Full Episodes 3hr",
        youtubeChannelId: "UC-fan-reupload",
        levelBand: "beginner",
        visualAccentTags: [],
        topics: [],
        legalStatus: "unofficial_reupload",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("unofficial_reupload");
    expect(insertSingle).not.toHaveBeenCalled();
  });

  it("rejects a major-IP-excluded channel even though it is tagged as a legitimate source (EC-003-A, 400)", async () => {
    const { POST } = await import("./channels/route");
    const response = await POST(
      postRequest({
        name: "Disney Official Clips",
        youtubeChannelId: "UC-disney",
        levelBand: "basic",
        visualAccentTags: [],
        topics: [],
        legalStatus: "major_ip_excluded",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("major_ip_excluded");
    expect(insertSingle).not.toHaveBeenCalled();
  });

  it("rejects an embed-disabled channel (EC-003-B enforcement at entry)", async () => {
    const { POST } = await import("./channels/route");
    const response = await POST(
      postRequest({
        name: "Some Embed Disabled Channel",
        youtubeChannelId: "UC-embed-disabled",
        levelBand: "professional",
        visualAccentTags: [],
        topics: [],
        legalStatus: "embed_disabled",
      }),
    );

    expect(response.status).toBe(400);
    expect(insertSingle).not.toHaveBeenCalled();
  });

  it("rejects invalid request payloads (missing required fields)", async () => {
    const { POST } = await import("./channels/route");
    const response = await POST(
      postRequest({
        name: "",
      }),
    );

    expect(response.status).toBe(400);
    expect(insertSingle).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/premium/channels (Task 4.1 list)", () => {
  beforeEach(() => {
    selectOrder.mockReset();
  });

  it("lists whitelist channels ordered by created_at", async () => {
    selectOrder.mockResolvedValue({
      data: [
        {
          id: "channel-1",
          name: "BBC Learning English",
          youtube_channel_id: "UC-bbc",
          level_band: "conversation",
          visual_accent_tags: ["standard-accent"],
          topics: ["news"],
          active: true,
          legal_status: "official",
        },
      ],
      error: null,
    });

    const { GET } = await import("./channels/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.channels).toHaveLength(1);
    expect(payload.channels[0].legalStatus).toBe("official");
  });
});
