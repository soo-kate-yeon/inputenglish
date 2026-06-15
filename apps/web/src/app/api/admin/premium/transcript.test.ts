import { beforeEach, describe, expect, it, vi } from "vitest";

const loadTranscriptWithYtDlp = vi.hoisted(() => vi.fn());

vi.mock("@/utils/supabase/admin-auth", () => ({
  requireAdmin: vi.fn(async () => ({
    id: "admin-user",
    email: "admin@example.com",
  })),
}));

vi.mock("@/lib/premium/youtube-transcript", () => ({
  loadTranscriptWithYtDlp,
}));

describe("POST /api/admin/premium/transcript", () => {
  beforeEach(() => {
    loadTranscriptWithYtDlp.mockReset();
  });

  it("loads a YouTube transcript through the premium yt-dlp loader", async () => {
    loadTranscriptWithYtDlp.mockResolvedValue({
      metadata: {
        title: "Premium source",
        duration: 420,
        channel: "InputEnglish",
        thumbnail: "https://img.youtube.com/vi/video-1/hqdefault.jpg",
      },
      transcript: [
        {
          id: "yt-1",
          text: "Thank you for having me here.",
          startTime: 10,
          endTime: 12,
        },
      ],
    });

    const { POST } = await import("./transcript/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/transcript", {
        method: "POST",
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=video-1",
        }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(loadTranscriptWithYtDlp).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=video-1",
    );
    expect(payload.metadata).toMatchObject({
      title: "Premium source",
      duration: 420,
      channel: "InputEnglish",
    });
    expect(payload.transcript).toEqual([
      {
        id: "yt-1",
        text: "Thank you for having me here.",
        startTime: 10,
        endTime: 12,
      },
    ]);
  });

  it("rejects invalid source URLs", async () => {
    const { POST } = await import("./transcript/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/transcript", {
        method: "POST",
        body: JSON.stringify({
          sourceUrl: "not-a-url",
        }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid premium transcript payload");
    expect(loadTranscriptWithYtDlp).not.toHaveBeenCalled();
  });

  it("returns a clear loader failure", async () => {
    loadTranscriptWithYtDlp.mockRejectedValue(
      new Error("yt-dlp did not return an English subtitle track"),
    );

    const { POST } = await import("./transcript/route");
    const response = await POST(
      new Request("http://localhost/api/admin/premium/transcript", {
        method: "POST",
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=video-1",
        }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error).toBe(
      "yt-dlp did not return an English subtitle track",
    );
  });
});
