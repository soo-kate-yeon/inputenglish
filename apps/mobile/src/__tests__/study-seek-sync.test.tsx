/**
 * Tests for StudyScreen script highlight sync behavior.
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
 * 4. Loop seekTo activates seekLock (300ms) to prevent stale-time flicker.
 *
 * 5. Session-end seekTo activates seekLock (300ms) to prevent stale-time flicker.
 *
 * Strategy: extract and unit-test the seek-lock / debounce state machine
 * without rendering the full StudyScreen component.
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
 * Factory that creates an isolated instance of the seek-lock / debounce
 * state machine matching StudyScreen.handleSentenceTap, loop handling,
 * and session-end handling.
 */
function createStudyMachine(
  options: {
    playerBaseOffset?: number;
    sessionEndTime?: number;
    playerStartSeconds?: number;
  } = {},
) {
  const {
    playerBaseOffset = 0,
    sessionEndTime = 0,
    playerStartSeconds = 0,
  } = options;

  const seekLockRef = { current: false };
  const isPollingRef = { current: false };
  const seekDebounce: { current: ReturnType<typeof setTimeout> | null } = {
    current: null,
  };
  const activeIdRef: { current: string | null } = { current: null };
  const loopIdRef: { current: string | null } = { current: null };

  let activeSentenceId: string | null = null;
  const setActiveSentenceId = (id: string | null) => {
    activeSentenceId = id;
  };

  let playing = true;
  const setPlaying = (p: boolean) => {
    playing = p;
  };

  const seekToCalls: Array<{ time: number }> = [];
  const playerRef = {
    current: {
      seekTo: (time: number) => seekToCalls.push({ time }),
      getCurrentTime: jest.fn(),
    },
  };

  function handleSentenceTap(sentence: Sentence) {
    if (seekDebounce.current) clearTimeout(seekDebounce.current);
    seekLockRef.current = true;
    activeIdRef.current = sentence.id;
    setActiveSentenceId(sentence.id);

    seekDebounce.current = setTimeout(() => {
      playerRef.current?.seekTo(sentence.startTime + playerBaseOffset);
      setTimeout(() => {
        seekLockRef.current = false;
      }, 500);
    }, 300);
  }

  function setLooping(sentenceId: string | null) {
    loopIdRef.current = sentenceId;
  }

  /**
   * Simulates one polling tick (synchronous version for tests — the real
   * code uses async getCurrentTime, guarded by isPollingRef to prevent
   * overlapping calls). Returns whether activeSentenceId changed.
   */
  function simulatePollingTick(
    currentTime: number,
    mainTab: "listening" | "shadowing" = "listening",
  ): boolean {
    if (seekLockRef.current || isPollingRef.current) return false;

    const offset = playerBaseOffset;
    const rel = Math.max(0, currentTime - offset);

    // Session end check
    if (sessionEndTime > 0 && rel >= sessionEndTime) {
      seekLockRef.current = true;
      setPlaying(false);
      playerRef.current?.seekTo(playerStartSeconds);
      setTimeout(() => {
        seekLockRef.current = false;
      }, 300);
      return false;
    }

    // Loop (listening only)
    if (mainTab === "listening") {
      const lid = loopIdRef.current;
      if (lid) {
        const ls = SENTENCES.find((s) => s.id === lid);
        if (ls && rel >= ls.endTime - 0.08) {
          seekLockRef.current = true;
          activeIdRef.current = ls.id;
          setActiveSentenceId(ls.id);
          playerRef.current?.seekTo(ls.startTime + offset);
          setTimeout(() => {
            seekLockRef.current = false;
          }, 300);
          return true;
        }
      }
    }

    // Active sentence detection
    let active: Sentence | undefined;
    for (let i = SENTENCES.length - 1; i >= 0; i--) {
      if (SENTENCES[i].startTime <= rel && rel < SENTENCES[i].endTime) {
        active = SENTENCES[i];
        break;
      }
    }
    if (!active && SENTENCES.length > 0) {
      const last = SENTENCES[SENTENCES.length - 1];
      if (rel >= last.startTime) active = last;
    }

    if (active && active.id !== activeIdRef.current) {
      activeIdRef.current = active.id;
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
    getPlaying: () => playing,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StudyScreen seek-lock / debounce state machine", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- Sentence tap: immediate feedback ---

  it("sets activeSentenceId immediately on tap", () => {
    const machine = createStudyMachine();
    machine.handleSentenceTap({ id: "s2", startTime: 4, endTime: 6 });
    expect(machine.getActiveSentenceId()).toBe("s2");
  });

  it("activates seekLock immediately on tap", () => {
    const machine = createStudyMachine();
    machine.handleSentenceTap({ id: "s2", startTime: 4, endTime: 6 });
    expect(machine.getSeekLock()).toBe(true);
  });

  // --- Polling blocked during lock ---

  it("polling does not overwrite activeSentenceId while seekLock is held", () => {
    const machine = createStudyMachine();
    machine.handleSentenceTap({ id: "s2", startTime: 4, endTime: 6 });

    const changed = machine.simulatePollingTick(0.5);
    expect(changed).toBe(false);
    expect(machine.getActiveSentenceId()).toBe("s2");
  });

  it("activeSentenceId never reverts during the full 800ms lock window", () => {
    const machine = createStudyMachine();
    machine.handleSentenceTap({ id: "s2", startTime: 4, endTime: 6 });

    const snapshots: Array<string | null> = [];
    for (let elapsed = 0; elapsed < 700; elapsed += 100) {
      act(() => {
        jest.advanceTimersByTime(100);
      });
      machine.simulatePollingTick(0.5);
      snapshots.push(machine.getActiveSentenceId());
    }

    for (const snap of snapshots) {
      expect(snap).toBe("s2");
    }
  });

  // --- Debounced seekTo ---

  it("delays seekTo by 300ms debounce", () => {
    const machine = createStudyMachine();
    machine.handleSentenceTap({ id: "s1", startTime: 2, endTime: 4 });

    expect(machine.getSeekToCalls()).toHaveLength(0);

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(machine.getSeekToCalls()).toHaveLength(1);
    expect(machine.getSeekToCalls()[0].time).toBe(2);
  });

  it("seekTo uses playerBaseOffset", () => {
    const machine = createStudyMachine({ playerBaseOffset: 10 });
    machine.handleSentenceTap({ id: "s1", startTime: 2, endTime: 4 });

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(machine.getSeekToCalls()[0].time).toBe(12);
  });

  // --- Lock release timing ---

  it("releases seekLock 500ms after seekTo (total 800ms)", () => {
    const machine = createStudyMachine();
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
    const machine = createStudyMachine();
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
    const machine = createStudyMachine();
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
    const machine = createStudyMachine();
    machine.setLooping("s1");

    machine.simulatePollingTick(3.95);

    expect(machine.getSeekLock()).toBe(true);
    expect(machine.getActiveSentenceId()).toBe("s1");
    expect(machine.getSeekToCalls()).toHaveLength(1);
    expect(machine.getSeekToCalls()[0].time).toBe(2);
  });

  it("loop seekLock releases after 300ms", () => {
    const machine = createStudyMachine();
    machine.setLooping("s1");

    machine.simulatePollingTick(3.95);

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(machine.getSeekLock()).toBe(false);
  });

  it("polling is blocked during loop seekLock window", () => {
    const machine = createStudyMachine();
    machine.setLooping("s1");

    machine.simulatePollingTick(3.95);

    const changed = machine.simulatePollingTick(3.9);
    expect(changed).toBe(false);
    expect(machine.getActiveSentenceId()).toBe("s1");
  });

  // --- Session end seekTo lock ---

  it("session-end seekTo activates seekLock", () => {
    const machine = createStudyMachine({
      sessionEndTime: 6,
      playerStartSeconds: 0,
    });

    // Poll at a time past session end
    machine.simulatePollingTick(6.5);

    expect(machine.getSeekLock()).toBe(true);
    expect(machine.getPlaying()).toBe(false);
    expect(machine.getSeekToCalls()).toHaveLength(1);
    expect(machine.getSeekToCalls()[0].time).toBe(0);
  });

  it("session-end seekLock releases after 300ms", () => {
    const machine = createStudyMachine({
      sessionEndTime: 6,
      playerStartSeconds: 0,
    });

    machine.simulatePollingTick(6.5);

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(machine.getSeekLock()).toBe(false);
  });

  it("polling is blocked during session-end seekLock window", () => {
    const machine = createStudyMachine({
      sessionEndTime: 6,
      playerStartSeconds: 0,
    });

    machine.simulatePollingTick(6.5);

    const changed = machine.simulatePollingTick(5.5);
    expect(changed).toBe(false);
  });

  // --- Concurrent polling guard ---

  it("blocks polling when isPolling is true (prevents overlapping async calls)", () => {
    const machine = createStudyMachine();
    machine.setIsPolling(true);

    const changed = machine.simulatePollingTick(2.5);
    expect(changed).toBe(false);
    expect(machine.getActiveSentenceId()).toBe(null);
  });

  it("allows polling when isPolling is released", () => {
    const machine = createStudyMachine();
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
    const machine = createStudyMachine();
    expect(machine.getSeekLock()).toBe(false);

    const changed = machine.simulatePollingTick(2.5);
    expect(changed).toBe(true);
    expect(machine.getActiveSentenceId()).toBe("s1");
  });
});
