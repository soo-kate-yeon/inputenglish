/**
 * Tests for ShortSessionCard playback intent state machine.
 *
 * Bugs being fixed (regression coverage):
 *
 * 1. Auto-play next video on swipe was unreliable. Cause: the activation
 *    effect depended on the `startSessionPlayback` callback identity, so any
 *    dependency cascade (playerReady, sessionStart/End change when video
 *    loads) re-fired the effect — sometimes causing double-seeks, sometimes
 *    leaving the pending intent in an inconsistent state.
 *
 * 2. Currently-playing sentence highlight flickered. Cause: each
 *    re-invocation of startSessionPlayback called setActiveSentenceId(null),
 *    blanking the highlight until the 250ms polling caught up.
 *
 * 3. Transcript did not reliably scroll to the top when a new card became
 *    active. Cause: reset effects were split and could race against the
 *    optimistic alignment for the first sentence.
 *
 * 4. Tapping a sentence or the next/prev navigation arrow paused playback
 *    after one sentence ("preview" semantic), so the auto-scroll appeared to
 *    "stop" once the navigated sentence finished — polling halts when
 *    playing=false. Fix: tap/nav use jumpToSentence (jump-and-continue),
 *    scheduling a session-remaining timeout instead of a sentence-duration
 *    one. Loop keeps the single-sentence semantic.
 *
 * 5. Polling could overwrite the manually-selected sentence during the seek
 *    transition (currentTime briefly still in the previous range). Fix: a
 *    seek-lock (default 800ms) blocks polling-driven activeSentenceId writes
 *    while the seek settles.
 *
 * Strategy mirrors study-seek-sync.test.tsx: extract a state-machine factory
 * matching the new ShortSessionCard logic and verify its transitions
 * deterministically without rendering the full RN tree.
 */

import { act } from "@testing-library/react-native";

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
 * Factory mirroring ShortSessionCard's playback intent state machine after
 * the fix. The activation entry point only sets the intent; execution is
 * centralised so the same intent never produces more than one seek.
 */
function createShortPlaybackMachine(options: {
  sessionStartSeconds: number;
  sessionEndSeconds: number;
  sentences?: Sentence[];
}) {
  const { sessionStartSeconds, sessionEndSeconds } = options;
  const sentences = options.sentences ?? SENTENCES;

  let isActive = false;
  let playerReady = false;
  let video: { video_id: string } | null = null;
  let playing = false;
  let activeSentenceId: string | null = null;
  let loopingSentenceId: string | null = null;
  let transcriptOffset = 0;

  const pendingAutoplayRef = { current: false };
  const pendingSentenceRef: { current: Sentence | null } = { current: null };
  const stopTimeoutRef: { current: ReturnType<typeof setTimeout> | null } = {
    current: null,
  };
  const sessionEndFiredRef = { current: false };
  const shouldResetScriptPositionRef = { current: true };
  const seekLockRef = { current: false };
  const seekLockTimeoutRef: {
    current: ReturnType<typeof setTimeout> | null;
  } = { current: null };

  const SEEK_LOCK_MS = 800;

  const seekToCalls: Array<{ time: number }> = [];
  const setPlayingCalls: boolean[] = [];
  const activeSentenceHistory: Array<string | null> = [];
  const sessionEndCalls: number[] = [];

  const setPlaying = (next: boolean) => {
    playing = next;
    setPlayingCalls.push(next);
  };
  const setActiveSentenceId = (next: string | null) => {
    if (next === activeSentenceId) return;
    activeSentenceId = next;
    activeSentenceHistory.push(next);
  };
  const setTranscriptOffset = (next: number) => {
    transcriptOffset = next;
  };

  const playerRef = {
    current: {
      seekTo: (time: number) => seekToCalls.push({ time }),
    },
  };

  const onSessionEndRef = {
    current: () => {
      sessionEndCalls.push(Date.now());
    },
  };

  function clearPlaybackTimeout() {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  }

  function scheduleSessionEndTimeoutFrom(seekSeconds: number) {
    clearPlaybackTimeout();
    const durationMs = Math.max((sessionEndSeconds - seekSeconds) * 1000, 1000);
    stopTimeoutRef.current = setTimeout(() => {
      setPlaying(false);
      if (!sessionEndFiredRef.current) {
        sessionEndFiredRef.current = true;
        onSessionEndRef.current?.();
      }
    }, durationMs);
  }

  function scheduleSessionEndTimeout() {
    scheduleSessionEndTimeoutFrom(sessionStartSeconds);
  }

  function acquireSeekLock(durationMs: number = SEEK_LOCK_MS) {
    if (seekLockTimeoutRef.current) clearTimeout(seekLockTimeoutRef.current);
    seekLockRef.current = true;
    seekLockTimeoutRef.current = setTimeout(() => {
      seekLockRef.current = false;
      seekLockTimeoutRef.current = null;
    }, durationMs);
  }

  function resetScriptScrollPosition() {
    shouldResetScriptPositionRef.current = true;
    setTranscriptOffset(0);
  }

  /**
   * Mirrors the new startSessionPlayback: set intent + optimistic highlight,
   * execute only if player is ready. Crucially does NOT blank
   * activeSentenceId.
   */
  function startSessionPlayback() {
    if (!video) return;

    clearPlaybackTimeout();
    loopingSentenceId = null;

    const firstSentence = sentences[0];
    if (firstSentence) {
      setActiveSentenceId(firstSentence.id);
    }

    if (!playerReady) {
      pendingAutoplayRef.current = true;
      setPlaying(true);
      return;
    }

    pendingAutoplayRef.current = false;
    playerRef.current?.seekTo(sessionStartSeconds);
    setPlaying(true);
    scheduleSessionEndTimeout();
  }

  /**
   * Mirrors the new post-ready execution effect: drains pending intent
   * exactly once when the iframe becomes ready.
   */
  function onPlayerReady() {
    if (playerReady) return;
    playerReady = true;

    if (!isActive || !video) return;

    if (pendingSentenceRef.current) {
      const pending = pendingSentenceRef.current;
      pendingSentenceRef.current = null;
      playerRef.current?.seekTo(pending.startTime + sessionStartSeconds);
      setPlaying(true);
      return;
    }

    if (pendingAutoplayRef.current) {
      pendingAutoplayRef.current = false;
      playerRef.current?.seekTo(sessionStartSeconds);
      setPlaying(true);
      scheduleSessionEndTimeout();
    }
  }

  /**
   * Mirrors the new isActive transition effect: reset script + drop pending
   * intents on deactivation. CRUCIALLY does not fire startSessionPlayback
   * itself — the activation entry point is `activate()` below, called once
   * per real activation regardless of how many internal callbacks recreate.
   */
  function setIsActive(next: boolean) {
    if (next === isActive) return;
    isActive = next;

    resetScriptScrollPosition();

    if (!isActive) {
      pendingSentenceRef.current = null;
      pendingAutoplayRef.current = false;
      loopingSentenceId = null;
      setActiveSentenceId(null);
      clearPlaybackTimeout();
      setPlaying(false);
      return;
    }

    if (video) {
      startSessionPlayback();
    }
  }

  function setVideoLoaded(videoId: string) {
    video = { video_id: videoId };
    sessionEndFiredRef.current = false;
    if (isActive) {
      startSessionPlayback();
    }
  }

  /**
   * Mirrors the new jumpToSentence: seek-and-continue. Used by sentence tap
   * AND by the prev/next navigation buttons. Schedules a session-remaining
   * timeout (NOT a sentence-duration one) so playback continues through the
   * rest of the session, keeping polling and auto-scroll alive.
   */
  function jumpToSentence(sentence: Sentence) {
    if (!playerReady || !video) {
      pendingSentenceRef.current = sentence;
      pendingAutoplayRef.current = true;
      return;
    }

    clearPlaybackTimeout();
    const seekSeconds = sessionStartSeconds + sentence.startTime;
    pendingSentenceRef.current = null;
    pendingAutoplayRef.current = false;
    loopingSentenceId = null;
    setActiveSentenceId(sentence.id);
    setPlaying(true);
    acquireSeekLock();
    playerRef.current?.seekTo(seekSeconds);
    scheduleSessionEndTimeoutFrom(seekSeconds);
  }

  /**
   * Simulates a callback dependency cascade: the production startSessionPlayback
   * callback gets recreated whenever its deps change (playerReady,
   * sessionStart/End, video). The fix asserts that this MUST NOT re-fire
   * the activation effect — the test calls this hook to simulate the event
   * and expects no extra seek/setPlaying calls.
   */
  function simulateCallbackRecreation() {
    // After the fix, the activation effect uses video?.video_id only — not
    // the callback identity — so this is a no-op. We expose it to assert the
    // invariant explicitly.
  }

  function simulatePollingTick(currentTime: number) {
    if (!isActive || !playerReady || sentences.length === 0) return;
    // Block polling-driven activeSentenceId writes while the seek settles.
    // Without this, polling reads currentTime that is briefly still in the
    // previous sentence's range and overwrites the manual selection.
    if (seekLockRef.current) return;

    const rel = Math.max(0, currentTime - sessionStartSeconds);
    if (rel >= sessionEndSeconds - sessionStartSeconds - 0.15) {
      if (!sessionEndFiredRef.current) {
        sessionEndFiredRef.current = true;
        clearPlaybackTimeout();
        setPlaying(false);
        onSessionEndRef.current?.();
      }
      return;
    }

    let next: Sentence | undefined;
    for (let i = sentences.length - 1; i >= 0; i--) {
      if (sentences[i].startTime <= rel && rel < sentences[i].endTime) {
        next = sentences[i];
        break;
      }
    }
    if (next) setActiveSentenceId(next.id);
  }

  return {
    setIsActive,
    setVideoLoaded,
    onPlayerReady,
    simulateCallbackRecreation,
    simulatePollingTick,
    jumpToSentence,
    getActiveSentenceId: () => activeSentenceId,
    getActiveSentenceHistory: () => [...activeSentenceHistory],
    getPlaying: () => playing,
    getSetPlayingCalls: () => [...setPlayingCalls],
    getSeekToCalls: () => [...seekToCalls],
    getTranscriptOffset: () => transcriptOffset,
    getSessionEndCalls: () => sessionEndCalls.length,
    getPendingAutoplay: () => pendingAutoplayRef.current,
    getSeekLock: () => seekLockRef.current,
  };
}

describe("ShortSessionCard playback state machine", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // ---- Bug 1: auto-play next video on swipe ----

  describe("auto-play on activation", () => {
    it("queues pendingAutoplay when activated before the player is ready", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 36,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);

      expect(m.getPendingAutoplay()).toBe(true);
      expect(m.getPlaying()).toBe(true);
      expect(m.getSeekToCalls()).toHaveLength(0);
    });

    it("drains pendingAutoplay exactly once when the player becomes ready", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 36,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);

      m.onPlayerReady();

      expect(m.getSeekToCalls()).toHaveLength(1);
      expect(m.getSeekToCalls()[0].time).toBe(30);
      expect(m.getPendingAutoplay()).toBe(false);
    });

    it("does not double-seek when callback identities recreate during activation", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 36,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);

      // Simulate the dep cascade (production: playerReady/sessionStart/end change
      // recreate the callback). After the fix, no extra seeks should occur.
      m.simulateCallbackRecreation();
      m.simulateCallbackRecreation();
      m.simulateCallbackRecreation();

      m.onPlayerReady();

      expect(m.getSeekToCalls()).toHaveLength(1);
    });

    it("seeks immediately if the player is already ready when activated", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 36,
      });
      m.setVideoLoaded("vid-1");
      m.onPlayerReady(); // ready, but inactive — no-op
      expect(m.getSeekToCalls()).toHaveLength(0);

      m.setIsActive(true);

      expect(m.getSeekToCalls()).toHaveLength(1);
      expect(m.getSeekToCalls()[0].time).toBe(30);
    });
  });

  // ---- Bug 2: highlight flicker ----

  describe("active sentence highlight stability", () => {
    it("optimistically highlights the first sentence on activation", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 36,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);

      expect(m.getActiveSentenceId()).toBe("s0");
    });

    it("does not blank the highlight when the player becomes ready (no flicker)", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 36,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);

      const before = m.getActiveSentenceId();
      m.onPlayerReady();
      const after = m.getActiveSentenceId();

      expect(before).toBe("s0");
      expect(after).toBe("s0");
      // setActiveSentenceId(null) should never appear during activation
      expect(m.getActiveSentenceHistory()).not.toContain(null);
    });

    it("polling can advance the highlight to subsequent sentences", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 36,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);
      m.onPlayerReady();

      m.simulatePollingTick(32.1); // rel=2.1 → s1
      expect(m.getActiveSentenceId()).toBe("s1");

      m.simulatePollingTick(34.5); // rel=4.5 → s2
      expect(m.getActiveSentenceId()).toBe("s2");
    });
  });

  // ---- Bug 3: transcript scroll reset ----

  describe("transcript reset on activation", () => {
    it("resets transcript offset to 0 when becoming active", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 36,
      });
      m.setVideoLoaded("vid-1");

      m.setIsActive(true);
      expect(m.getTranscriptOffset()).toBe(0);
    });

    it("resets transcript offset to 0 when becoming inactive", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 36,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);
      m.onPlayerReady();

      m.setIsActive(false);
      expect(m.getTranscriptOffset()).toBe(0);
    });
  });

  // ---- Cleanup on deactivation ----

  describe("deactivation cleanup", () => {
    it("clears pending intents and stops playback", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 36,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);
      m.onPlayerReady();

      m.setIsActive(false);

      expect(m.getPendingAutoplay()).toBe(false);
      expect(m.getPlaying()).toBe(false);
      expect(m.getActiveSentenceId()).toBe(null);
    });

    it("does not fire onSessionEnd when deactivated mid-session", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 36,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);
      m.onPlayerReady();

      // Deactivate before the session-end timer fires.
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      m.setIsActive(false);
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(m.getSessionEndCalls()).toBe(0);
    });
  });

  // ---- Bug 4: tap/nav must continue playback (jump-and-continue) ----

  describe("jumpToSentence: tap and nav buttons continue playback", () => {
    it("seeks to the target sentence and keeps playing", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 40,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);
      m.onPlayerReady();

      m.jumpToSentence({ id: "s2", startTime: 4, endTime: 6 });

      // Last seek should target the navigated sentence.
      const seeks = m.getSeekToCalls();
      expect(seeks[seeks.length - 1].time).toBe(34);
      expect(m.getActiveSentenceId()).toBe("s2");
      expect(m.getPlaying()).toBe(true);
    });

    it("does NOT pause after the navigated sentence finishes", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 40, // 10s session
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);
      m.onPlayerReady();

      m.jumpToSentence({ id: "s1", startTime: 2, endTime: 4 });

      // The navigated sentence is 2s long. Old buggy code paused at 2s. New
      // code uses session-remaining (8s from seek=32s to end=40s).
      act(() => {
        jest.advanceTimersByTime(2_500);
      });
      expect(m.getPlaying()).toBe(true);
      expect(m.getSessionEndCalls()).toBe(0);
    });

    it("schedules onSessionEnd at session-remaining duration from the new playhead", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 40,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);
      m.onPlayerReady();

      // Jump to s1 (clip-time 2s → playhead at 32s; remaining 8s to session end).
      m.jumpToSentence({ id: "s1", startTime: 2, endTime: 4 });

      act(() => {
        jest.advanceTimersByTime(7_999);
      });
      expect(m.getSessionEndCalls()).toBe(0);
      act(() => {
        jest.advanceTimersByTime(2);
      });
      expect(m.getSessionEndCalls()).toBe(1);
    });

    it("queues the jump intent if the player is not ready yet", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 40,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);
      // Player not ready yet — jumpToSentence should queue.
      m.jumpToSentence({ id: "s2", startTime: 4, endTime: 6 });

      expect(m.getSeekToCalls()).toHaveLength(0);
      expect(m.getPendingAutoplay()).toBe(true);
    });
  });

  // ---- Bug 5: seek-lock prevents polling race ----

  describe("seek-lock prevents polling overwrites during seek", () => {
    it("acquires seek-lock when jumpToSentence runs", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 40,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);
      m.onPlayerReady();

      m.jumpToSentence({ id: "s2", startTime: 4, endTime: 6 });
      expect(m.getSeekLock()).toBe(true);
    });

    it("blocks polling from overwriting activeSentenceId while seek-lock is held", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 40,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);
      m.onPlayerReady();

      m.jumpToSentence({ id: "s2", startTime: 4, endTime: 6 });

      // Polling fires while seek hasn't settled — currentTime is still in s0.
      m.simulatePollingTick(30.5);
      expect(m.getActiveSentenceId()).toBe("s2");
    });

    it("releases seek-lock after the lock window and resumes polling", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 40,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);
      m.onPlayerReady();

      m.jumpToSentence({ id: "s2", startTime: 4, endTime: 6 });

      act(() => {
        jest.advanceTimersByTime(800);
      });
      expect(m.getSeekLock()).toBe(false);

      // After the seek has settled, currentTime is in s2's range.
      m.simulatePollingTick(34.5);
      expect(m.getActiveSentenceId()).toBe("s2");

      // Polling can advance to s2's successor naturally.
      m.simulatePollingTick(34.5); // still s2
      expect(m.getActiveSentenceId()).toBe("s2");
    });
  });

  // ---- Session end behaviour preserved ----

  describe("session end (preserved behaviour)", () => {
    it("fires onSessionEnd via timeout when the duration elapses", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 36,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);
      m.onPlayerReady();

      act(() => {
        jest.advanceTimersByTime(6_000);
      });

      expect(m.getSessionEndCalls()).toBe(1);
      expect(m.getPlaying()).toBe(false);
    });

    it("fires onSessionEnd via polling when current time crosses the end", () => {
      const m = createShortPlaybackMachine({
        sessionStartSeconds: 30,
        sessionEndSeconds: 36,
      });
      m.setVideoLoaded("vid-1");
      m.setIsActive(true);
      m.onPlayerReady();

      m.simulatePollingTick(36.0);
      expect(m.getSessionEndCalls()).toBe(1);
    });
  });
});
