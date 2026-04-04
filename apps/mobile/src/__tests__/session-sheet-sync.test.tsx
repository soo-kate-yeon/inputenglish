/**
 * Tests for SessionSheet script highlight sync behavior.
 *
 * Core invariants being verified:
 *
 * 1. After handleSentencePress, activeSentenceId stays on the pressed sentence
 *    and does not flicker to a previous sentence.
 *
 * 2. The polling loop does NOT overwrite the manual selection while seekLock
 *    is active (i.e., during the debounce + bridge settle window).
 *
 * 3. After seekLock is released (800 ms after tap), polling correctly resumes
 *    and tracks the player position.
 *
 * Strategy: extract and unit-test the seek-lock / debounce state machine
 * without rendering the full SessionSheet component, which requires a live
 * WebView / YouTubePlayer.  We simulate the exact ref mutations that
 * handleSentencePress performs and verify the observable behaviour.
 */

import { act } from "@testing-library/react-native";

// ---------------------------------------------------------------------------
// Helpers that replicate the state machine from SessionSheet
// ---------------------------------------------------------------------------

interface Sentence {
  id: string;
  startTime: number;
  endTime: number;
}

/**
 * Factory that creates an isolated instance of the seek-lock + debounce
 * state machine used in SessionSheet.handleSentencePress, without any
 * React rendering or WebView dependency.
 */
function createSeekMachine(playerBaseOffset: number = 0) {
  // Mirrors the refs in SessionSheet
  const seekLockRef = { current: false };
  const seekDebounce: { current: ReturnType<typeof setTimeout> | null } = {
    current: null,
  };
  const activeSentenceIdRef: { current: string | null } = { current: null };

  // Observable output (mirrors setActiveSentenceId)
  let activeSentenceId: string | null = null;
  const setActiveSentenceId = (id: string | null) => {
    activeSentenceId = id;
  };

  // Records all seekTo calls so tests can assert timing
  const seekToCalls: Array<{ time: number; at: number }> = [];
  const playerRef = {
    current: {
      seekTo: (time: number) => seekToCalls.push({ time, at: Date.now() }),
      getCurrentTime: jest.fn(),
    },
  };

  /**
   * The fixed handleSentencePress implementation from SessionSheet.
   * Must exactly match the production code.
   */
  function handleSentencePress(sentence: Sentence) {
    if (seekDebounce.current) clearTimeout(seekDebounce.current);
    seekLockRef.current = true;
    activeSentenceIdRef.current = sentence.id;
    setActiveSentenceId(sentence.id);

    seekDebounce.current = setTimeout(() => {
      playerRef.current?.seekTo(playerBaseOffset + sentence.startTime);
      setTimeout(() => {
        seekLockRef.current = false;
      }, 500);
    }, 300);
  }

  /**
   * Simulates one polling tick.  Returns whether polling changed
   * activeSentenceId.
   */
  function simulatePollingTick(currentTime: number): boolean {
    if (seekLockRef.current) return false;
    const rel = Math.max(0, currentTime - playerBaseOffset);
    // Simple sentinel sentence list used in polling tests
    const sentences: Sentence[] = [
      { id: "s0", startTime: 0, endTime: 2 },
      { id: "s1", startTime: 2, endTime: 4 },
      { id: "s2", startTime: 4, endTime: 6 },
    ];
    const active = sentences.find((s) => rel >= s.startTime && rel < s.endTime);
    if (active && active.id !== activeSentenceIdRef.current) {
      activeSentenceIdRef.current = active.id;
      setActiveSentenceId(active.id);
      return true;
    }
    return false;
  }

  return {
    handleSentencePress,
    simulatePollingTick,
    getActiveSentenceId: () => activeSentenceId,
    getSeekLock: () => seekLockRef.current,
    getSeekToCalls: () => seekToCalls,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SessionSheet seek-lock / debounce state machine", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // 1. Immediate state set on tap
  // -------------------------------------------------------------------------

  it("sets activeSentenceId immediately when sentence is pressed", () => {
    const machine = createSeekMachine(0);
    const sentence: Sentence = { id: "s2", startTime: 4, endTime: 6 };

    machine.handleSentencePress(sentence);

    expect(machine.getActiveSentenceId()).toBe("s2");
  });

  // -------------------------------------------------------------------------
  // 2. seekLock is true immediately after press (polling must not interfere)
  // -------------------------------------------------------------------------

  it("activates seekLock immediately after press", () => {
    const machine = createSeekMachine(0);
    const sentence: Sentence = { id: "s2", startTime: 4, endTime: 6 };

    machine.handleSentencePress(sentence);

    expect(machine.getSeekLock()).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 3. Polling does NOT overwrite manual selection while seekLock is active
  // -------------------------------------------------------------------------

  it("polling does not overwrite activeSentenceId while seekLock is held", () => {
    const machine = createSeekMachine(0);
    const sentence: Sentence = { id: "s2", startTime: 4, endTime: 6 };

    machine.handleSentencePress(sentence);

    // Simulate polling ticks at a position that corresponds to s0
    // (before the seek has settled).  Polling must be blocked.
    const changed = machine.simulatePollingTick(0.5);

    expect(changed).toBe(false);
    expect(machine.getActiveSentenceId()).toBe("s2");
  });

  // -------------------------------------------------------------------------
  // 4. seekTo is issued only after the 300 ms debounce
  // -------------------------------------------------------------------------

  it("delays seekTo by 300 ms debounce before issuing the seek", () => {
    const machine = createSeekMachine(0);
    const sentence: Sentence = { id: "s1", startTime: 2, endTime: 4 };

    machine.handleSentencePress(sentence);

    // Before debounce fires — no seekTo yet
    expect(machine.getSeekToCalls()).toHaveLength(0);

    act(() => {
      jest.advanceTimersByTime(299);
    });

    expect(machine.getSeekToCalls()).toHaveLength(0);

    act(() => {
      jest.advanceTimersByTime(1); // total 300 ms
    });

    expect(machine.getSeekToCalls()).toHaveLength(1);
    expect(machine.getSeekToCalls()[0].time).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 5. seekTo uses playerBaseOffset + sentence.startTime
  // -------------------------------------------------------------------------

  it("seekTo is called with playerBaseOffset + sentence.startTime", () => {
    const playerBaseOffset = 10;
    const machine = createSeekMachine(playerBaseOffset);
    const sentence: Sentence = { id: "s1", startTime: 2, endTime: 4 };

    machine.handleSentencePress(sentence);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(machine.getSeekToCalls()[0].time).toBe(12); // 10 + 2
  });

  // -------------------------------------------------------------------------
  // 6. seekLock is released 500 ms after debounce fires (total ~800 ms)
  // -------------------------------------------------------------------------

  it("releases seekLock 500 ms after seekTo is issued", () => {
    const machine = createSeekMachine(0);
    const sentence: Sentence = { id: "s1", startTime: 2, endTime: 4 };

    machine.handleSentencePress(sentence);

    // After debounce: seekTo issued, lock still held
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(machine.getSeekLock()).toBe(true);

    // 499 ms later — still locked
    act(() => {
      jest.advanceTimersByTime(499);
    });
    expect(machine.getSeekLock()).toBe(true);

    // 1 ms more — released
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(machine.getSeekLock()).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 7. After lock release, polling resumes correctly
  // -------------------------------------------------------------------------

  it("polling correctly updates activeSentenceId after seekLock is released", () => {
    const machine = createSeekMachine(0);
    const sentence: Sentence = { id: "s2", startTime: 4, endTime: 6 };

    machine.handleSentencePress(sentence);

    // Wait for full lock window to expire (300 + 500 ms)
    act(() => {
      jest.advanceTimersByTime(800);
    });

    expect(machine.getSeekLock()).toBe(false);

    // Now simulate polling at position that matches s0
    // Polling should update activeSentenceId to s0
    const changed = machine.simulatePollingTick(0.5);

    expect(changed).toBe(true);
    expect(machine.getActiveSentenceId()).toBe("s0");
  });

  // -------------------------------------------------------------------------
  // 8. Rapid double-tap: second tap cancels first debounce
  // -------------------------------------------------------------------------

  it("second tap cancels the pending seekTo from the first tap", () => {
    const machine = createSeekMachine(0);
    const sentenceA: Sentence = { id: "s0", startTime: 0, endTime: 2 };
    const sentenceB: Sentence = { id: "s2", startTime: 4, endTime: 6 };

    machine.handleSentencePress(sentenceA);

    // Advance partially through debounce, then tap again
    act(() => {
      jest.advanceTimersByTime(150);
    });

    machine.handleSentencePress(sentenceB);

    // Advance past where the first debounce would have fired
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Only ONE seekTo should have been called (for sentenceB)
    expect(machine.getSeekToCalls()).toHaveLength(1);
    expect(machine.getSeekToCalls()[0].time).toBe(4);

    // Final state should be sentenceB
    expect(machine.getActiveSentenceId()).toBe("s2");
  });

  // -------------------------------------------------------------------------
  // 9. No seek-lock flicker: activeSentenceId never reverts after press
  // -------------------------------------------------------------------------

  it("activeSentenceId never reverts to a previous sentence during the full lock window", () => {
    const machine = createSeekMachine(0);
    const sentence: Sentence = { id: "s2", startTime: 4, endTime: 6 };

    machine.handleSentencePress(sentence);

    const snapshots: Array<string | null> = [];

    // Simulate polling every 100 ms at a stale position (s0 territory)
    // throughout 700 ms — safely within the 800 ms lock window
    // (300 ms debounce + 500 ms post-seek settle).
    for (let elapsed = 0; elapsed < 700; elapsed += 100) {
      act(() => {
        jest.advanceTimersByTime(100);
      });
      machine.simulatePollingTick(0.5); // would resolve to s0 if unlocked
      snapshots.push(machine.getActiveSentenceId());
    }

    // Every snapshot captured while lock is held must remain s2
    for (const snap of snapshots) {
      expect(snap).toBe("s2");
    }
  });

  // -------------------------------------------------------------------------
  // 10. seekLock false before any press
  // -------------------------------------------------------------------------

  it("seekLock starts false and polling works before any press", () => {
    const machine = createSeekMachine(0);

    expect(machine.getSeekLock()).toBe(false);

    const changed = machine.simulatePollingTick(2.5); // s1 territory
    expect(changed).toBe(true);
    expect(machine.getActiveSentenceId()).toBe("s1");
  });
});
