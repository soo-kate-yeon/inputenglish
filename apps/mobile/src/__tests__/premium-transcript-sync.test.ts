import {
  findPremiumActiveTranscriptLine,
  getPremiumTranscriptScrollIndex,
  PREMIUM_TRANSCRIPT_SYNC_INTERVAL_MS,
} from "../lib/premium-transcript-sync";

const lines = [
  { id: "a", text: "A", startTime: 0, endTime: 1 },
  { id: "b", text: "B", startTime: 1.01, endTime: 3 },
  { id: "c", text: "C", startTime: 3.01, endTime: 5 },
];

describe("premium transcript sync", () => {
  it("uses the 100ms sync interval required by the premium spec", () => {
    expect(PREMIUM_TRANSCRIPT_SYNC_INTERVAL_MS).toBe(100);
  });

  it("finds the active transcript line for the current playback time", () => {
    expect(findPremiumActiveTranscriptLine(lines, 1.5)?.id).toBe("b");
    expect(findPremiumActiveTranscriptLine(lines, 6)).toBeNull();
  });

  it("returns a stable scroll index for active line ids", () => {
    expect(getPremiumTranscriptScrollIndex(lines, "c")).toBe(2);
    expect(getPremiumTranscriptScrollIndex(lines, "missing")).toBe(0);
    expect(getPremiumTranscriptScrollIndex(lines, null)).toBe(0);
  });
});
