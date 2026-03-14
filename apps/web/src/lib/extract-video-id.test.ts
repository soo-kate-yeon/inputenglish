import { describe, expect, it } from "vitest";
import { extractVideoId } from "@shadowoo/shared";

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
    expect(extractVideoId("T5kaBzDThkY")).toBe("T5kaBzDThkY");
  });

  it("returns null for non-youtube strings", () => {
    expect(extractVideoId("not a url")).toBeNull();
    expect(
      extractVideoId("https://example.com/watch?v=T5kaBzDThkY"),
    ).toBeNull();
    expect(extractVideoId("")).toBeNull();
  });
});
