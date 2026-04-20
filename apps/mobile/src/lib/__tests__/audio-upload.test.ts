import {
  inferAudioUploadMeta,
  normalizeAudioBlobForUpload,
} from "../audio-upload";

describe("inferAudioUploadMeta", () => {
  it("returns audio/wav when URI ends in .wav even if blob.type is audio/vnd.wave", () => {
    const meta = inferAudioUploadMeta(
      "file:///var/mobile/Containers/.../rec.wav",
      "audio/vnd.wave",
    );
    expect(meta).toEqual({ extension: "wav", contentType: "audio/wav" });
  });

  it("falls back to m4a when no clue is provided", () => {
    expect(inferAudioUploadMeta("file:///tmp/rec", "")).toEqual({
      extension: "m4a",
      contentType: "audio/mp4",
    });
  });
});

describe("normalizeAudioBlobForUpload", () => {
  const makeBlob = (type: string): Blob =>
    new Blob([new Uint8Array([1, 2, 3, 4])], { type });

  it("rewraps a blob reported as audio/vnd.wave with the whitelisted audio/wav type", () => {
    // This is the exact TestFlight reproduction: Sentry issue 7427328797
    // showed Supabase rejecting a blob whose .type was "audio/vnd.wave"
    // despite inferAudioUploadMeta returning contentType: "audio/wav".
    const blob = makeBlob("audio/vnd.wave");
    const meta = { extension: "wav", contentType: "audio/wav" };

    const normalized = normalizeAudioBlobForUpload(blob, meta);

    expect(normalized.type).toBe("audio/wav");
    expect(normalized).not.toBe(blob);
  });

  it("passes the blob through unchanged when its type already matches", () => {
    const blob = makeBlob("audio/wav");
    const meta = { extension: "wav", contentType: "audio/wav" };

    const normalized = normalizeAudioBlobForUpload(blob, meta);

    expect(normalized).toBe(blob);
  });

  it("is case-insensitive when comparing blob.type to meta.contentType", () => {
    const blob = makeBlob("AUDIO/WAV");
    const meta = { extension: "wav", contentType: "audio/wav" };

    const normalized = normalizeAudioBlobForUpload(blob, meta);

    expect(normalized).toBe(blob);
  });

  it("forces the type when blob.type is empty", () => {
    const blob = makeBlob("");
    const meta = { extension: "m4a", contentType: "audio/mp4" };

    const normalized = normalizeAudioBlobForUpload(blob, meta);

    expect(normalized.type).toBe("audio/mp4");
  });
});
