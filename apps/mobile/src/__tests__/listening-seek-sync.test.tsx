/**
 * Tests for ListeningScreen script highlight sync behavior.
 *
 * Core invariants being verified:
 *
 * 1. After handleSentenceTap, activeSentenceId is set immediately and does
 *    not flicker to a previous sentence.
 *
 * 2. The polling loop does NOT overwrite the manual selection while seekLock
 *    is active (debounce 300ms + bridge settle 500ms = 800ms window).
 *
 * 3. After seekLock is released, polling correctly resumes.
 *
 * 4. Loop seekTo also activates seekLock to prevent stale-time flicker.
 *
 * Strategy: extract and unit-test the seek-lock / debounce state machine
 * without rendering the full ListeningScreen component.
 */

import { act } from "@testing-library/react-native";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Sentence {
  id: string;
  startTime: number;
  endTime: number;
}

const SENTENCES: Sentence[] = [
  { id: "s0", startTime: 0, endTime: 2 },
  { id: "s1", startTime: 2, endTime: 4 },
  { id: "s2", startTime: 4, endTime: 6 },
];

/**
 * Factory that creates an isolated instance of the seek-lock + debounce
 * state machine matching ListeningScreen.handleSentenceTap and the
 * polling loop.
 */
function createListeningMachine(snippetStartTime: number = 0) {
  const seekLockRef = { current: false };
  const isPollingRef = { current: false };
  const seekDebounceRef: { current: ReturnType<typeof setTimeout> | null } = {
    current: null,
  };
  const activeSentenceIdRef: { current: string | null } = { current: null };
  const loopingSentenceIdRef: { current: string | null } = { current: null };

  let activeSentenceId: string | null = null;
  const setActiveSentenceId = (id: string | null) => {
    activeSentenceId = id;
  };

  const seekToCalls: Array<{ time: number }> = [];
  const playerRef = {
    current: {
      seekTo: (time: number) => seekToCalls.push({ time }),
      getCurrentTime: jest.fn(),
    },
  };

  const LOOP_SEEK_LEAD_MS = 0.08;

  function handleSentenceTap(sentence: Sentence) {
    if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
    seekLockRef.current = true;
    activeSentenceIdRef.current = sentence.id;
    setActiveSentenceId(sentence.id);

    seekDebounceRef.current = setTimeout(() => {
      const offset = snippetStartTime;
      playerRef.current?.seekTo(sentence.startTime + offset);
      setTimeout(() => {
        seekLockRef.current = false;
      }, 500);
    }, 300);
  }

  function setLooping(sentenceId: string | null) {
    loopingSentenceIdRef.current = sentenceId;
  }

  /**
   * Simulates one polling tick (synchronous version for tests — the real
   * code uses async getCurrentTime, guarded by isPollingRef to prevent
   * overlapping calls). Returns whether activeSentenceId changed.
   */
  function simulatePollingTick(currentTime: number): boolean {
    if (seekLockRef.current || isPollingRef.current) return false;

    const relativeTime = currentTime - snippetStartTime;

    // Loop handling
    const loopId = loopingSentenceIdRef.current;
    if (loopId) {
      const loopSentence = SENTENCES.find((s) => s.id === loopId);
      if (
        loopSentence &&
        relativeTime >= loopSentence.endTime - LOOP_SEEK_LEAD_MS
      ) {
        seekLockRef.current = true;
        activeSentenceIdRef.current = loopSentence.id;
        setActiveSentenceId(loopSentence.id);
        playerRef.current?.seekTo(loopSentence.startTime + snippetStartTime);
        setTimeout(() => {
          seekLockRef.current = false;
        }, 300);
        return true;
      }
    }

    // Active sentence detection (reverse traversal)
    let active: Sentence | undefined;
    for (let i = SENTENCES.length - 1; i >= 0; i--) {
      if (SENTENCES[i].startTime <= relativeTime) {
        active = SENTENCES[i];
        break;
      }
    }

    if (active && active.id !== activeSentenceIdRef.current) {
      activeSentenceIdRef.current = active.id;
      setActiveSentenceId(active.id);
      return true;
    }
    return false;
  }

  return {
    handleSentenceTap,
    setLooping,
    simulatePollingTick,
    getActiveSentenceId: () => activeSentenceId,
    getSeekLock: () => seekLockRef.current,
    getIsPolling: () => isPollingRef.current,
    setIsPolling: (v: boolean) => {
      isPollingRef.current = v;
    },
    getSeekToCalls: () => seekToCalls,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ListeningScreen seek-lock / debounce state machine", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- Sentence tap: immediate feedback ---

  it("sets activeSentenceId immediately on tap", () => {
    const machine = createListeningMachine(0);
    machine.handleSentenceTap({ id: "s2", startTime: 4, endTime: 6 });
    expect(machine.getActiveSentenceId()).toBe("s2");
  });

  it("activates seekLock immediately on tap", () => {
    const machine = createListeningMachine(0);
    machine.handleSentenceTap({ id: "s2", startTime: 4, endTime: 6 });
    expect(machine.getSeekLock()).toBe(true);
  });

  // --- Polling blocked during lock ---

  it("polling does not overwrite activeSentenceId while seekLock is held", () => {
    const machine = createListeningMachine(0);
    machine.handleSentenceTap({ id: "s2", startTime: 4, endTime: 6 });

    // Poll at s0 territory — must be blocked
    const changed = machine.simulatePollingTick(0.5);
    expect(changed).toBe(false);
    expect(machine.getActiveSentenceId()).toBe("s2");
  });

  it("activeSentenceId never reverts during the full 800ms lock window", () => {
    const machine = createListeningMachine(0);
    machine.handleSentenceTap({ id: "s2", startTime: 4, endTime: 6 });

    const snapshots: Array<string | null> = [];
    for (let elapsed = 0; elapsed < 700; elapsed += 100) {
      act(() => {
        jest.advanceTimersByTime(100);
      });
      machine.simulatePollingTick(0.5); // stale s0 position
      snapshots.push(machine.getActiveSentenceId());
    }

    for (const snap of snapshots) {
      expect(snap).toBe("s2");
    }
  });

  // --- Debounced seekTo ---

  it("delays seekTo by 300ms debounce", () => {
    const machine = createListeningMachine(0);
    machine.handleSentenceTap({ id: "s1", startTime: 2, endTime: 4 });

    expect(machine.getSeekToCalls()).toHaveLength(0);

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(machine.getSeekToCalls()).toHaveLength(0);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(machine.getSeekToCalls()).toHaveLength(1);
    expect(machine.getSeekToCalls()[0].time).toBe(2);
  });

  it("seekTo uses snippetStartTime offset", () => {
    const machine = createListeningMachine(10);
    machine.handleSentenceTap({ id: "s1", startTime: 2, endTime: 4 });

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(machine.getSeekToCalls()[0].time).toBe(12);
  });

  // --- Lock release timing ---

  it("releases seekLock 500ms after seekTo (total 800ms)", () => {
    const machine = createListeningMachine(0);
    machine.handleSentenceTap({ id: "s1", startTime: 2, endTime: 4 });

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(machine.getSeekLock()).toBe(true);

    act(() => {
      jest.advanceTimersByTime(499);
    });
    expect(machine.getSeekLock()).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(machine.getSeekLock()).toBe(false);
  });

  it("polling resumes correctly after lock release", () => {
    const machine = createListeningMachine(0);
    machine.handleSentenceTap({ id: "s2", startTime: 4, endTime: 6 });

    act(() => {
      jest.advanceTimersByTime(800);
    });
    expect(machine.getSeekLock()).toBe(false);

    const changed = machine.simulatePollingTick(0.5);
    expect(changed).toBe(true);
    expect(machine.getActiveSentenceId()).toBe("s0");
  });

  // --- Rapid double-tap ---

  it("second tap cancels first pending seekTo", () => {
    const machine = createListeningMachine(0);
    machine.handleSentenceTap({ id: "s0", startTime: 0, endTime: 2 });

    act(() => {
      jest.advanceTimersByTime(150);
    });

    machine.handleSentenceTap({ id: "s2", startTime: 4, endTime: 6 });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(machine.getSeekToCalls()).toHaveLength(1);
    expect(machine.getSeekToCalls()[0].time).toBe(4);
    expect(machine.getActiveSentenceId()).toBe("s2");
  });

  // --- Loop seekTo lock ---

  it("loop seekTo activates seekLock to prevent stale-time flicker", () => {
    const machine = createListeningMachine(0);
    machine.setLooping("s1");

    // Simulate poll at the loop boundary (endTime - lead = 4 - 0.08 = 3.92)
    machine.simulatePollingTick(3.95);

    expect(machine.getSeekLock()).toBe(true);
    expect(machine.getActiveSentenceId()).toBe("s1");
    expect(machine.getSeekToCalls()).toHaveLength(1);
    expect(machine.getSeekToCalls()[0].time).toBe(2); // loop start
  });

  it("loop seekLock releases after 300ms", () => {
    const machine = createListeningMachine(0);
    machine.setLooping("s1");

    machine.simulatePollingTick(3.95);
    expect(machine.getSeekLock()).toBe(true);

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(machine.getSeekLock()).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(machine.getSeekLock()).toBe(false);
  });

  it("polling is blocked during loop seekLock window", () => {
    const machine = createListeningMachine(0);
    machine.setLooping("s1");

    // Trigger loop seek
    machine.simulatePollingTick(3.95);

    // Try polling at stale position during lock
    const changed = machine.simulatePollingTick(3.9);
    expect(changed).toBe(false);
    expect(machine.getActiveSentenceId()).toBe("s1");
  });

  // --- Concurrent polling guard ---

  it("blocks polling when isPolling is true (prevents overlapping async calls)", () => {
    const machine = createListeningMachine(0);
    machine.setIsPolling(true);

    const changed = machine.simulatePollingTick(2.5);
    expect(changed).toBe(false);
    expect(machine.getActiveSentenceId()).toBe(null);
  });

  it("allows polling when isPolling is released", () => {
    const machine = createListeningMachine(0);
    machine.setIsPolling(true);

    machine.simulatePollingTick(2.5);
    expect(machine.getActiveSentenceId()).toBe(null);

    machine.setIsPolling(false);

    const changed = machine.simulatePollingTick(2.5);
    expect(changed).toBe(true);
    expect(machine.getActiveSentenceId()).toBe("s1");
  });

  // --- Initial state ---

  it("seekLock starts false and polling works before any interaction", () => {
    const machine = createListeningMachine(0);
    expect(machine.getSeekLock()).toBe(false);

    const changed = machine.simulatePollingTick(2.5);
    expect(changed).toBe(true);
    expect(machine.getActiveSentenceId()).toBe("s1");
  });
});
