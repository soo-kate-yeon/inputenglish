## SPEC-MOBILE-004 Progress

- Started: 2026-03-07
- Completed: 2026-03-07

## Acceptance Criteria Status

| AC | Description | Status |
|----|-------------|--------|
| AC-001 | useAudioRecorder Hook (idle/recording/playback state machine) | DONE |
| AC-002 | 녹음 시작 (YouTube pause + start recording) | DONE |
| AC-003 | RecordingBar - recording state (stop button + duration) | DONE |
| AC-004 | RecordingBar - playback state (play/pause/progress/rerecord/confirm) | DONE |
| AC-005 | Mode toggle (sentence/paragraph/total with groupSentencesByMode) | DONE |
| AC-006 | Background handling (AppState listener stops recording + pauses player) | DONE |
| AC-007 | Microphone permission (request + deny alert) | DONE |
| AC-008 | Recording confirm and save (recordedSentences state + hasRecording indicator) | DONE |
| AC-009 | TypeScript strict mode: 0 errors | DONE |

## Files Created

- apps/mobile/src/hooks/useAudioRecorder.ts
- apps/mobile/src/hooks/__tests__/useAudioRecorder.test.ts
- apps/mobile/src/components/shadowing/RecordingBar.tsx
- apps/mobile/src/components/shadowing/ShadowingHeader.tsx
- apps/mobile/src/components/shadowing/ShadowingScriptLine.tsx
- apps/mobile/src/components/shadowing/__tests__/RecordingBar.test.tsx
- apps/mobile/src/components/shadowing/__tests__/ShadowingHeader.test.tsx
- apps/mobile/src/components/shadowing/__tests__/ShadowingScriptLine.test.tsx
- apps/mobile/src/__tests__/shadowing.test.tsx

## Files Modified

- apps/mobile/app/shadowing/[videoId].tsx (rewritten from 32-line stub)
- apps/mobile/app.json (added microphone permissions + expo-av plugin)
- apps/mobile/tsconfig.json (excluded test files from typecheck)
- apps/mobile/package.json (expo-av added)

## Iteration Log

| Iteration | AC Completed | TS Errors |
|-----------|-------------|-----------|
| 1 | AC-001 through AC-009 | 0 |

## Post-Run Bug Fixes

### Bug Fix 1: playRecording Position Reset
- Date: 2026-03-07
- File: apps/mobile/src/hooks/useAudioRecorder.ts
- Issue: playRecording() resumed from last position instead of start
- Solution: Added setPositionAsync(0) before replay
- Impact: Recording playback now always starts from beginning

### Bug Fix 2: resetRecording Race Condition
- Date: 2026-03-07
- Files: apps/mobile/src/hooks/useAudioRecorder.ts, apps/mobile/app/shadowing/[videoId].tsx
- Issue: Async cleanup not awaited, causing audio session locks on next recording
- Solution: Made resetRecording async, awaited cleanupRecording() and cleanupSound()
- Updated callers: handleConfirm() and handleReRecord() now await resetRecording()
- Impact: Audio session properly released before state reset, prevents recording errors

### Bug Fix 3: crypto.randomUUID() Hermes Compatibility
- Date: 2026-03-07
- File: packages/shared/src/lib/transcript-parser.ts
- Issue: crypto.randomUUID() unavailable in some Hermes builds
- Solution: Added generateId() helper with Math.random() UUID v4 fallback
- Replacement: All crypto.randomUUID() calls replaced with generateId()
- Impact: React Native Hermes compatibility, works on all JS engines
