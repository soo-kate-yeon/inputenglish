const mockInsert = jest.fn();
const mockFrom = jest.fn();
const mockSavePlaybookEntry = jest.fn();

jest.mock("../lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

jest.mock("../lib/api", () => ({
  savePlaybookEntry: (...args: unknown[]) => mockSavePlaybookEntry(...args),
}));

import {
  buildPremiumCompletionAssets,
  persistPremiumCompletionAssets,
} from "../lib/premium-completion";
import { jonnyKimPremiumSessionFixture } from "../fixtures/premium-session";

describe("premium completion assets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockSavePlaybookEntry.mockResolvedValue({});
  });

  it("maps expression cards to saved sentence and playbook payloads", () => {
    const assets = buildPremiumCompletionAssets(jonnyKimPremiumSessionFixture);

    expect(assets).toHaveLength(
      jonnyKimPremiumSessionFixture.expression_cards.length,
    );
    expect(assets[0].savedSentence).toEqual(
      expect.objectContaining({
        video_id: jonnyKimPremiumSessionFixture.source_video_id,
        premium_session_id: jonnyKimPremiumSessionFixture.id,
        session_title: jonnyKimPremiumSessionFixture.title,
        sentence_id: "jk-2",
        sentence_text:
          "I have had the privilege of wearing different uniforms in my life.",
      }),
    );
    expect(assets[0].playbookEntry).toEqual(
      expect.objectContaining({
        sessionId: jonnyKimPremiumSessionFixture.id,
        practiceMode: "bookmark",
        userRewrite: "I had the privilege of leading the launch.",
        attemptMetadata: expect.objectContaining({
          premiumSessionId: jonnyKimPremiumSessionFixture.id,
          sessionTitle: jonnyKimPremiumSessionFixture.title,
        }),
      }),
    );
  });

  it("persists every expression to saved sentences and playbook entries", async () => {
    await expect(
      persistPremiumCompletionAssets("user-1", jonnyKimPremiumSessionFixture),
    ).resolves.toBe(jonnyKimPremiumSessionFixture.expression_cards.length);

    expect(mockFrom).toHaveBeenCalledWith("saved_sentences");
    expect(mockInsert).toHaveBeenCalledTimes(
      jonnyKimPremiumSessionFixture.expression_cards.length,
    );
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        premium_session_id: jonnyKimPremiumSessionFixture.id,
        session_title: jonnyKimPremiumSessionFixture.title,
      }),
    );
    expect(mockSavePlaybookEntry).toHaveBeenCalledTimes(
      jonnyKimPremiumSessionFixture.expression_cards.length,
    );
    expect(mockSavePlaybookEntry).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        sessionId: jonnyKimPremiumSessionFixture.id,
        practiceMode: "bookmark",
      }),
    );
  });

  it("throws when saved sentence persistence fails", async () => {
    mockInsert.mockResolvedValueOnce({
      error: new Error("saved sentence insert failed"),
    });

    await expect(
      persistPremiumCompletionAssets("user-1", jonnyKimPremiumSessionFixture),
    ).rejects.toThrow("saved sentence insert failed");
  });
});
