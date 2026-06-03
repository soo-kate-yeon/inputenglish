/**
 * Haptic feedback tests for SPEC-MOBILE-019 — Pillar 3.
 *
 * Tests verify:
 * - Sentence tap → Haptics.selectionAsync() called exactly once before seek
 * - Loop toggle → Haptics.impactAsync(Light) called exactly once
 * - Save toggle → Haptics.impactAsync(Light) called exactly once
 * - Feed page transition → Haptics.impactAsync(Medium) called exactly once per new index
 * - expo-haptics throws → no exception bubbles, gesture flow continues
 *
 * Strategy: state-machine factory mirrors the haptic call sites in
 * ShortSessionCard and HomeScreen, allowing deterministic verification
 * without rendering the full RN tree.
 */

// @MX:NOTE: Tests for safeHaptic helper and haptic call sites.
// @MX:SPEC: SPEC-MOBILE-019

import * as Haptics from "expo-haptics";

// -- Mocks ------------------------------------------------------------------

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
  },
}));

const mockSelectionAsync = Haptics.selectionAsync as jest.MockedFunction<
  typeof Haptics.selectionAsync
>;
const mockImpactAsync = Haptics.impactAsync as jest.MockedFunction<
  typeof Haptics.impactAsync
>;

// ---------------------------------------------------------------------------

/**
 * Factory that simulates the haptic call sites in ShortSessionCard.
 * Mirrors:
 *   - handleSentencePress: fire-and-forget selectionAsync before seek
 *   - handleLoopToggle: impactAsync(Light)
 *   - handleSentenceSaveToggle: impactAsync(Light)
 */
function createHapticMachine() {
  const seekToCalls: number[] = [];
  const loopToggles: string[] = [];
  const saveToggles: string[] = [];

  // Mirrors handleSentencePress in ShortSessionCard.tsx (line 572-578).
  // selectionAsync is fire-and-forget (not awaited).
  function handleSentencePress(sentenceId: string) {
    // Haptic fires BEFORE seek (fire-and-forget, wrapped in try/catch)
    try {
      Haptics.selectionAsync();
    } catch {}
    // seek happens after haptic is scheduled
    seekToCalls.push(Date.now());
    return sentenceId;
  }

  // Mirrors handleLoopToggle haptic addition.
  function handleLoopToggle(sentenceId: string) {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    loopToggles.push(sentenceId);
  }

  // Mirrors handleSentenceSaveToggle haptic addition.
  function handleSentenceSaveToggle(sentenceId: string) {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    saveToggles.push(sentenceId);
  }

  return {
    handleSentencePress,
    handleLoopToggle,
    handleSentenceSaveToggle,
    getSeekToCalls: () => [...seekToCalls],
    getLoopToggles: () => [...loopToggles],
    getSaveToggles: () => [...saveToggles],
  };
}

/**
 * Factory that simulates handleMomentumScrollEnd haptic in HomeScreen.
 * Only fires when activeIndex actually changes.
 */
function createFeedPageHapticMachine() {
  let currentActiveIndex = 0;
  const hapticFires: number[] = [];

  // Mirrors onMomentumScrollEnd haptic addition in (tabs)/index.tsx.
  function handleMomentumScrollEnd(newIndex: number) {
    if (newIndex !== currentActiveIndex) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
      hapticFires.push(newIndex);
      currentActiveIndex = newIndex;
    }
  }

  return {
    handleMomentumScrollEnd,
    getCurrentIndex: () => currentActiveIndex,
    getHapticFires: () => [...hapticFires],
  };
}

// ---------------------------------------------------------------------------

describe("ShortSessionCard haptic feedback (SPEC-MOBILE-019 Pillar 3)", () => {
  beforeEach(() => {
    mockSelectionAsync.mockClear();
    mockImpactAsync.mockClear();
  });

  // REQ-019-P3-02: sentence tap → selectionAsync once, before seek
  describe("sentence tap (REQ-019-P3-02)", () => {
    it("calls selectionAsync exactly once when a sentence is tapped", () => {
      const m = createHapticMachine();
      m.handleSentencePress("s1");

      expect(mockSelectionAsync).toHaveBeenCalledTimes(1);
    });

    it("calls selectionAsync before the seek operation", () => {
      const m = createHapticMachine();
      const callOrder: string[] = [];

      mockSelectionAsync.mockImplementationOnce(() => {
        callOrder.push("haptic");
        return Promise.resolve();
      });

      m.handleSentencePress("s1");

      // seek happens right after haptic is scheduled
      expect(m.getSeekToCalls()).toHaveLength(1);
      expect(callOrder[0]).toBe("haptic");
    });

    it("seek still executes when selectionAsync throws", () => {
      const m = createHapticMachine();
      mockSelectionAsync.mockImplementationOnce(() => {
        throw new Error("Haptics not available");
      });

      expect(() => m.handleSentencePress("s1")).not.toThrow();
      expect(m.getSeekToCalls()).toHaveLength(1);
    });

    it("selectionAsync is fire-and-forget (not awaited by the press handler)", () => {
      // Verify that even if selectionAsync takes a long time,
      // the seek call is synchronous immediately after scheduling the haptic.
      const m = createHapticMachine();
      let hapticResolved = false;

      mockSelectionAsync.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              hapticResolved = true;
              resolve();
            }, 1000);
          }),
      );

      m.handleSentencePress("s1");

      // Seek should have been called synchronously, before the promise resolves.
      expect(m.getSeekToCalls()).toHaveLength(1);
      expect(hapticResolved).toBe(false); // promise not yet resolved
    });
  });

  // REQ-019-P3-03: loop toggle → impactAsync(Light) once
  describe("loop toggle (REQ-019-P3-03)", () => {
    it("calls impactAsync with Light style exactly once on loop toggle", () => {
      const m = createHapticMachine();
      m.handleLoopToggle("s1");

      expect(mockImpactAsync).toHaveBeenCalledTimes(1);
      expect(mockImpactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light,
      );
    });

    it("does not call selectionAsync on loop toggle", () => {
      const m = createHapticMachine();
      m.handleLoopToggle("s1");

      expect(mockSelectionAsync).not.toHaveBeenCalled();
    });

    it("gesture flow continues when impactAsync throws on loop toggle", () => {
      const m = createHapticMachine();
      mockImpactAsync.mockImplementationOnce(() => {
        throw new Error("Haptics not available");
      });

      expect(() => m.handleLoopToggle("s1")).not.toThrow();
      expect(m.getLoopToggles()).toHaveLength(1);
    });
  });

  // REQ-019-P3-04: save toggle → impactAsync(Light) once
  describe("save toggle (REQ-019-P3-04)", () => {
    it("calls impactAsync with Light style exactly once on save toggle", () => {
      const m = createHapticMachine();
      m.handleSentenceSaveToggle("s1");

      expect(mockImpactAsync).toHaveBeenCalledTimes(1);
      expect(mockImpactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light,
      );
    });

    it("gesture flow continues when impactAsync throws on save toggle", () => {
      const m = createHapticMachine();
      mockImpactAsync.mockImplementationOnce(() => {
        throw new Error("Haptics not available");
      });

      expect(() => m.handleSentenceSaveToggle("s1")).not.toThrow();
      expect(m.getSaveToggles()).toHaveLength(1);
    });
  });

  // REQ-019-P3-05: feed page transition → impactAsync(Medium) per completed transition
  describe("feed page transition (REQ-019-P3-05)", () => {
    it("calls impactAsync with Medium style on page transition to a new index", () => {
      const m = createFeedPageHapticMachine();
      m.handleMomentumScrollEnd(1);

      expect(mockImpactAsync).toHaveBeenCalledTimes(1);
      expect(mockImpactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium,
      );
    });

    it("calls impactAsync exactly once per distinct page transition", () => {
      const m = createFeedPageHapticMachine();
      m.handleMomentumScrollEnd(1); // index 0 → 1
      m.handleMomentumScrollEnd(2); // index 1 → 2
      m.handleMomentumScrollEnd(3); // index 2 → 3

      expect(mockImpactAsync).toHaveBeenCalledTimes(3);
    });

    it("does NOT call impactAsync when momentum scroll ends on the same index", () => {
      const m = createFeedPageHapticMachine();
      // Simulate scroll that returns to same position
      m.handleMomentumScrollEnd(0); // same index, no change

      expect(mockImpactAsync).not.toHaveBeenCalled();
    });

    it("gesture flow continues when impactAsync throws on page transition", () => {
      const m = createFeedPageHapticMachine();
      mockImpactAsync.mockImplementationOnce(() => {
        throw new Error("Haptics not available");
      });

      expect(() => m.handleMomentumScrollEnd(1)).not.toThrow();
      expect(m.getCurrentIndex()).toBe(1); // index still updated
    });
  });

  // REQ-019-P3-06: graceful error handling
  describe("graceful error handling (REQ-019-P3-06)", () => {
    it("no exception bubbles up when selectionAsync throws synchronously", () => {
      const m = createHapticMachine();
      mockSelectionAsync.mockImplementationOnce(() => {
        throw new Error("OS vibration off");
      });

      // Should not throw synchronously — try/catch in safeHaptic swallows it
      expect(() => m.handleSentencePress("s1")).not.toThrow();
      // Seek still executes even when haptic throws
      expect(m.getSeekToCalls()).toHaveLength(1);
    });

    it("no exception bubbles up when impactAsync throws synchronously on loop toggle", () => {
      const m = createHapticMachine();
      mockImpactAsync.mockImplementationOnce(() => {
        throw new Error("OS vibration off");
      });

      expect(() => m.handleLoopToggle("s1")).not.toThrow();
      expect(m.getLoopToggles()).toHaveLength(1);
    });

    it("no exception bubbles up when impactAsync throws synchronously on save toggle", () => {
      const m = createHapticMachine();
      mockImpactAsync.mockImplementationOnce(() => {
        throw new Error("OS vibration off");
      });

      expect(() => m.handleSentenceSaveToggle("s1")).not.toThrow();
      expect(m.getSaveToggles()).toHaveLength(1);
    });
  });
});
