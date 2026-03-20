import { describe, expect, it } from "vitest";
import { extractVideoId, normalizeYouTubeUrl } from "@inputenglish/shared";

describe("extractVideoId", () => {
  it("extracts ids from common YouTube URL formats", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=T5kaBzDThkY")).toBe(
      "T5kaBzDThkY",
    );
    expect(extractVideoId("https://youtu.be/T5kaBzDThkY?si=test")).toBe(
      "T5kaBzDThkY",
    );
    expect(
      extractVideoId("https://m.youtube.com/watch?v=T5kaBzDThkY&t=30s"),
    ).toBe("T5kaBzDThkY");
    expect(extractVideoId("youtube.com/shorts/T5kaBzDThkY?feature=share")).toBe(
      "T5kaBzDThkY",
    );
    expect(
      extractVideoId("https://www.youtube.com/live/T5kaBzDThkY?feature=share"),
    ).toBe("T5kaBzDThkY");
    expect(
      extractVideoId("https://youtu.be/0Q5J8UB3mXE?si=5UCtyVBosN3YR5-v"),
    ).toBe("0Q5J8UB3mXE");
    expect(extractVideoId("T5kaBzDThkY")).toBe("T5kaBzDThkY");
  });

  it("normalizes pasted urls with hidden characters into a canonical share url", () => {
    expect(
      normalizeYouTubeUrl(
        '\u200B"https://youtu.be/0Q5J8UB3mXE?si=5UCtyVBosN3YR5-v"\uFEFF',
      ),
    ).toBe("https://youtu.be/0Q5J8UB3mXE");
  });

  it("returns null for non-youtube strings", () => {
    expect(extractVideoId("not a url")).toBeNull();
    expect(
      extractVideoId("https://example.com/watch?v=T5kaBzDThkY"),
    ).toBeNull();
    expect(extractVideoId("")).toBeNull();
  });
});
