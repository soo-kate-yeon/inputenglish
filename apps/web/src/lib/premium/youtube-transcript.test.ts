import { describe, expect, it, vi } from "vitest";
import {
  loadTranscriptWithYtDlp,
  parseJson3Transcript,
  parseVttTranscript,
  selectCaptionTrack,
} from "./youtube-transcript";

describe("premium youtube transcript loader", () => {
  it("parses json3 caption events into transcript lines", () => {
    expect(
      parseJson3Transcript({
        events: [
          {
            tStartMs: 1250,
            dDurationMs: 1800,
            segs: [{ utf8: " I had " }, { utf8: "the privilege\n" }],
          },
          {
            tStartMs: 4000,
            dDurationMs: 100,
            segs: [{ utf8: "  " }],
          },
        ],
      }),
    ).toEqual([
      {
        id: "yt-1",
        text: "I had the privilege",
        startTime: 1.25,
        endTime: 3.05,
      },
    ]);
  });

  it("prefers English json3 caption tracks", () => {
    expect(
      selectCaptionTrack({
        subtitles: {
          en: [
            { ext: "vtt", url: "https://caption.example/en.vtt" },
            { ext: "json3", url: "https://caption.example/en.json3" },
          ],
        },
        automatic_captions: {
          en: [{ ext: "json3", url: "https://caption.example/auto.json3" }],
        },
      }),
    ).toEqual({ ext: "json3", url: "https://caption.example/en.json3" });
  });

  it("parses WebVTT caption cues into transcript lines", () => {
    expect(
      parseVttTranscript(`WEBVTT

00:00:01.250 --> 00:00:03.050 align:start position:0%
<c>I had</c> the privilege

00:00:04.000 --> 00:00:05.500
of working with this team.
`),
    ).toEqual([
      {
        id: "yt-1",
        text: "I had the privilege",
        startTime: 1.25,
        endTime: 3.05,
      },
      {
        id: "yt-2",
        text: "of working with this team.",
        startTime: 4,
        endTime: 5.5,
      },
    ]);
  });

  it("loads metadata with yt-dlp and fetches the selected caption track", async () => {
    const execFileAsync = vi.fn().mockResolvedValue({
      stdout: JSON.stringify({
        title: "Premium source",
        duration: 420,
        subtitles: {
          en: [{ ext: "json3", url: "https://caption.example/en.json3" }],
        },
      }),
    });
    const fetchCaption = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({
          events: [
            {
              tStartMs: 10000,
              dDurationMs: 2000,
              segs: [{ utf8: "Thank you for having me here." }],
            },
          ],
        }),
    });

    const result = await loadTranscriptWithYtDlp(
      "https://www.youtube.com/watch?v=video-1",
      { execFileAsync, fetch: fetchCaption as typeof fetch },
    );

    expect(execFileAsync).toHaveBeenCalledWith(
      "yt-dlp",
      [
        "--dump-single-json",
        "--skip-download",
        "https://www.youtube.com/watch?v=video-1",
      ],
      { maxBuffer: 1024 * 1024 * 8 },
    );
    expect(fetchCaption).toHaveBeenCalledWith(
      "https://caption.example/en.json3",
    );
    expect(result.metadata.title).toBe("Premium source");
    expect(result.transcript).toEqual([
      {
        id: "yt-1",
        text: "Thank you for having me here.",
        startTime: 10,
        endTime: 12,
      },
    ]);
  });

  it("fails clearly when yt-dlp returns no English caption track", async () => {
    await expect(
      loadTranscriptWithYtDlp("https://www.youtube.com/watch?v=video-1", {
        execFileAsync: vi.fn().mockResolvedValue({
          stdout: JSON.stringify({ title: "No captions" }),
        }),
        fetch: vi.fn() as unknown as typeof fetch,
      }),
    ).rejects.toThrow("yt-dlp did not return an English subtitle track");
  });
});
