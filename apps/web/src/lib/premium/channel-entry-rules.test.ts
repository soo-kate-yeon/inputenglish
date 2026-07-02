import { describe, expect, it } from "vitest";
import {
  validateChannelEntry,
  type ChannelEntryCandidate,
} from "./channel-entry-rules";

function candidate(
  overrides: Partial<ChannelEntryCandidate> = {},
): ChannelEntryCandidate {
  return {
    name: "BBC Learning English",
    legalStatus: "official",
    ...overrides,
  };
}

describe("validateChannelEntry (REQ-WEB-003-U3, AC-003-2)", () => {
  it("accepts an official, embed-enabled, non-major-IP channel", () => {
    const result = validateChannelEntry(candidate());

    expect(result.accepted).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("rejects an unofficial reupload channel (AC-003-2)", () => {
    const result = validateChannelEntry(
      candidate({
        name: "Peppa Pig Full Episodes 3hr",
        legalStatus: "unofficial_reupload",
      }),
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("unofficial_reupload");
  });

  it("rejects an embed-disabled channel", () => {
    const result = validateChannelEntry(
      candidate({ legalStatus: "embed_disabled" }),
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("embed_disabled");
  });

  it("rejects a major-IP-excluded channel even when it is an official source (EC-003-A)", () => {
    // EC-003-A: an official Disney clip is still excluded for being major-IP.
    // legal_status already encodes this — 'major_ip_excluded' is a distinct value
    // from 'official', so an official-but-major-IP channel must be tagged
    // 'major_ip_excluded' (not 'official') at data-entry time. The validator's
    // single equality check against 'official' is sufficient to reject it.
    const result = validateChannelEntry(
      candidate({
        name: "Disney Official Clips",
        legalStatus: "major_ip_excluded",
      }),
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("major_ip_excluded");
  });

  it("rejects any legal_status value other than 'official'", () => {
    const statuses = [
      "unofficial_reupload",
      "embed_disabled",
      "major_ip_excluded",
    ] as const;

    for (const legalStatus of statuses) {
      const result = validateChannelEntry(candidate({ legalStatus }));
      expect(result.accepted).toBe(false);
    }
  });
});
