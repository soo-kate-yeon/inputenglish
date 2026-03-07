---
id: SPEC-MOBILE-004
version: "1.0.0"
status: completed
created: "2026-03-07"
updated: "2026-03-07"
author: MoAI
priority: P1
---

# SPEC-MOBILE-004: Audio Recording + Shadowing Screen

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-03-07 | MoAI | Initial SPEC creation |

---

## 1. Overview

### Context

Shadowoo는 YouTube 기반 영어 쉐도잉/리스닝 학습 플랫폼이다. SPEC-MOBILE-003에서 YouTube Player + Listening Screen이 완료되어, 리스닝 화면(287줄), YouTubePlayer 컴포넌트, 스크립트 동기화, 구간 반복, 문장 저장 기능이 모두 작동 중이다. 현재 `apps/mobile/app/shadowing/[videoId].tsx`는 32줄짜리 stub 상태이며, 오디오 녹음 기능은 구현되지 않았다.

웹 쉐도잉 구현(`apps/web/src/app/shadowing/[videoId]/page.tsx`, 387줄)과 `useAudioRecorder` hook(224줄)이 완전한 참조 패턴을 제공한다. 웹은 MediaRecorder API(WebM/Opus)를 사용하지만, 모바일은 `expo-av`(M4A/AAC)로 대체해야 한다.

### Goal

- `expo-av`를 사용한 오디오 녹음 hook을 구현한다 (웹 `useAudioRecorder` 인터페이스 미러)
- 쉐도잉 화면을 구현한다 (문장별 녹음, 재생, 비교)
- 녹음 상태 머신(idle -> recording -> playback)을 구현한다
- 모드 토글(sentence/paragraph/total)을 지원한다
- 녹음 데이터를 로컬(MMKV)에 저장한다

### Dependencies

- SPEC-MOBILE-003 (completed): YouTube Player + Listening Screen
- `@shadowoo/shared`: 타입(ShadowingRecord, Sentence), `groupSentencesByMode()`, store factory
- `expo-av` (신규 의존성)

---

## 2. Requirements (EARS Format)

### 2.1 Ubiquitous Requirements (REQ-U)

**REQ-U-001:** 오디오 녹음은 `expo-av` Audio.Recording API를 사용하여 구현되어야 한다 (SHALL).

**REQ-U-002:** 모든 컴포넌트는 TypeScript strict 모드로 작성되어야 한다 (SHALL).

**REQ-U-003:** 공유 타입(`ShadowingRecord`, `Sentence`, `StudySession`)은 `@shadowoo/shared`에서 import하여 사용해야 한다 (SHALL).

**REQ-U-004:** 녹음 파일 포맷은 M4A/AAC이어야 한다 (SHALL).

**REQ-U-005:** `useAudioRecorder` hook은 웹 구현과 동일한 인터페이스(`recordingState`, `startRecording`, `stopRecording`, `playRecording`, `pauseRecording`, `resetRecording`)를 제공해야 한다 (SHALL).

### 2.2 Event-Driven Requirements (REQ-E)

**REQ-E-001:** WHEN 사용자가 문장의 녹음 버튼을 탭하면, THEN YouTube 플레이어가 일시정지되고 오디오 녹음이 시작되어야 한다 (SHALL).

**REQ-E-002:** WHEN 사용자가 녹음 중 정지 버튼을 탭하면, THEN 녹음이 중지되고 재생 모드로 전환되어야 한다 (SHALL).

**REQ-E-003:** WHEN 사용자가 재생 모드에서 재생 버튼을 탭하면, THEN 녹음된 오디오가 재생되어야 한다 (SHALL).

**REQ-E-004:** WHEN 사용자가 재생 모드에서 재녹음 버튼을 탭하면, THEN 이전 녹음이 삭제되고 idle 상태로 돌아가야 한다 (SHALL).

**REQ-E-005:** WHEN 사용자가 모드 토글을 변경하면, THEN `groupSentencesByMode()`를 사용하여 스크립트 그룹핑이 변경되어야 한다 (SHALL).

**REQ-E-006:** WHEN 앱이 백그라운드로 전환되면, THEN 진행 중인 녹음이 중지되고 YouTube 플레이어가 일시정지되어야 한다 (SHALL).

**REQ-E-007:** WHEN 마이크 권한이 거부되면, THEN 사용자에게 권한 필요 안내 메시지를 표시하고 녹음 기능을 비활성화해야 한다 (SHALL).

### 2.3 State-Driven Requirements (REQ-S)

**REQ-S-001:** WHILE 녹음 상태(recording)인 동안, RecordingBar에 경과 시간이 표시되어야 한다 (SHALL).

**REQ-S-002:** WHILE 재생 상태(playback)인 동안, RecordingBar에 재생 진행률이 표시되어야 한다 (SHALL).

**REQ-S-003:** WHILE 녹음 상태인 동안, 녹음 버튼은 빨간색 정지 버튼으로 표시되어야 한다 (SHALL).

### 2.4 Unwanted Behavior Requirements (REQ-N)

**REQ-N-001:** 녹음 중 YouTube 플레이어가 재생되어서는 안 된다 (SHALL NOT).

**REQ-N-002:** 마이크 권한 없이 녹음이 시작되어서는 안 된다 (SHALL NOT).

**REQ-N-003:** 녹음 파일이 영구적으로 디바이스 스토리지에 무한 축적되어서는 안 된다 (SHALL NOT). 오래된 녹음은 정리 정책을 따라야 한다.

### 2.5 Complex Requirements (REQ-C)

**REQ-C-001:** IF 사용자가 문장을 선택하고 녹음 버튼을 탭하면, THEN YouTube 플레이어가 일시정지되고 루프가 해제되고, AND expo-av Recording이 시작되고, AND RecordingBar가 녹음 UI로 전환되어야 한다 (SHALL).

**REQ-C-002:** IF 녹음이 완료되고 사용자가 확인 버튼을 탭하면, THEN 녹음 파일이 로컬에 저장되고, AND 해당 문장에 녹음 완료 표시가 되어야 한다 (SHALL).

---

## 3. Scope

### In Scope

- `expo-av` 패키지 설치 및 설정
- `useAudioRecorder` hook (expo-av 기반, 웹 인터페이스 미러)
- 쉐도잉 화면 전체 구현 (`shadowing/[videoId].tsx` 재작성)
- ShadowingHeader 컴포넌트 (모드 토글: sentence/paragraph/total)
- ShadowingScriptLine 컴포넌트 (문장 + 녹음 상태 표시)
- RecordingBar 컴포넌트 (idle/recording/playback UI)
- 마이크 권한 요청 및 처리
- 녹음 파일 로컬 저장 (file URI)
- 백그라운드 전환 시 녹음 정지 처리
- `studyStore.updateSessionPhase('shadowing')` 연동

### Out of Scope

- Supabase Storage 업로드 (클라우드 동기화) -- 향후 SPEC
- `shadowing_recordings` DB 테이블 마이그레이션 -- 향후 SPEC
- `appStore` recordings 필드 확장 -- 향후 SPEC
- 녹음과 원본 오디오 비교 분석 (AI 기반) -- SPEC-MOBILE-006
- 텍스트 하이라이트/메모 기능 -- SPEC-MOBILE-005
- 오프라인 캐싱 -- SPEC-MOBILE-007

---

## 4. Technical Design

### 4.1 파일 구조

```
apps/mobile/
  app/
    shadowing/[videoId].tsx         (Rewrite - 쉐도잉 화면 전체)
  src/
    components/shadowing/          [NEW]
      ShadowingHeader.tsx          (모드 토글, 학습 종료)
      ShadowingScriptLine.tsx      (문장 + 녹음 버튼/상태)
      RecordingBar.tsx             (녹음/재생 하단 고정 UI)
    hooks/
      useAudioRecorder.ts          [NEW] (expo-av 기반)
```

### 4.2 녹음 상태 머신

```
idle ──[startRecording]──> recording
recording ──[stopRecording]──> playback
playback ──[resetRecording]──> idle
playback ──[confirmRecording]──> idle (파일 저장)
```

### 4.3 useAudioRecorder Interface

```typescript
interface UseAudioRecorder {
  recordingState: 'idle' | 'recording' | 'playback';
  audioUri: string | null;       // file URI (expo-av)
  duration: number;              // seconds
  isPlaying: boolean;
  playbackProgress: number;      // 0-1
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  playRecording: () => Promise<void>;
  pauseRecording: () => void;
  resetRecording: () => void;
}
```

### 4.4 쉐도잉 화면 레이아웃

```
+---------------------------+
| ShadowingHeader           |
| (제목, 모드토글, 학습종료) |
+---------------------------+
| YouTubePlayer             |
| (16:9, 리스닝과 동일)     |
+---------------------------+
| FlatList<ScriptLine>      |
| - 문장 텍스트             |
| - 녹음 버튼 (per sentence)|
| - 녹음 완료 표시          |
+---------------------------+
| RecordingBar (fixed)      |
| idle: 숨김                |
| recording: 정지+시간      |
| playback: 재생+진행+재녹음|
+---------------------------+
```

### 4.5 Key Integration Points

- **YouTubePlayer**: 리스닝과 동일한 ref 패턴 재사용 (`seekTo`, `getCurrentTime`)
- **groupSentencesByMode**: `@shadowoo/shared`에서 import
- **studyStore**: `updateSessionPhase(sessionId, 'shadowing')` 호출
- **AppState**: 백그라운드 전환 시 녹음 중지 + 플레이어 일시정지

### 4.6 expo-av Recording Settings

```typescript
{
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
  },
}
```

---

## 5. Traceability

| Requirement | Acceptance Criteria | Component |
|-------------|-------------------|-----------|
| REQ-U-001 | AC-001 | useAudioRecorder.ts |
| REQ-U-005 | AC-001 | useAudioRecorder.ts |
| REQ-E-001 | AC-002 | ShadowingScriptLine, [videoId].tsx |
| REQ-E-002, REQ-S-001 | AC-003 | RecordingBar, useAudioRecorder |
| REQ-E-003, REQ-S-002 | AC-004 | RecordingBar, useAudioRecorder |
| REQ-E-005 | AC-005 | ShadowingHeader |
| REQ-E-006 | AC-006 | [videoId].tsx |
| REQ-E-007, REQ-N-002 | AC-007 | useAudioRecorder |
| REQ-C-001 | AC-002, AC-003 | [videoId].tsx |
| REQ-C-002 | AC-008 | [videoId].tsx |

---

## 6. Implementation Notes

### 6.1 useAudioRecorder Hook (expo-av based)

The `useAudioRecorder` hook provides a state machine for audio recording with three states:

- **idle**: No recording in progress. audioUri is null, ready for startRecording()
- **recording**: Active audio recording. Duration increments every 100ms. stopRecording() transitions to playback
- **playback**: Recording completed and ready for playback/rerecord. playRecording() starts playback with progress tracking

Implementation uses expo-av's Audio.Recording API with M4A/AAC format, platform-specific settings for iOS and Android, microphone permission validation before recording, and proper cleanup in resetRecording() with await calls to cleanupRecording() and cleanupSound() to prevent race conditions.

**Key Bug Fixes Applied:**
- playRecording now calls setPositionAsync(0) before replay to reset position from previous playback
- resetRecording made async to ensure Audio.Recording and Sound objects are fully released before state reset

### 6.2 Shadowing Screen Implementation (apps/mobile/app/shadowing/[videoId].tsx)

Complete rewrite from 32-line stub to fully functional shadowing interface. Screen composition:

- **ShadowingHeader**: Displays video title, mode toggle (sentence/paragraph/total), and study completion button
- **YouTubePlayer**: Uses same ref pattern as listening screen with seekTo and getCurrentTime integration
- **FlatList**: Renders grouped sentences with per-sentence recording UI
- **RecordingBar**: Fixed bottom bar showing recording/playback controls and progress

Mode switching via groupSentencesByMode() from @shadowoo/shared recalculates script grouping without losing recording state. Background handling via AppState listener stops active recording and pauses player when app backgrounding occurs.

### 6.3 Component Architecture

**ShadowingHeader**: Mode toggle selects from sentence/paragraph/total modes. Each mode change calls groupSentencesByMode() with mode parameter to regroup visible script items. Completion button calls handleStudyCompletion() updating studyStore.

**ShadowingScriptLine**: Renders individual script item (sentence or paragraph) with recording button, recording status indicator, and hasRecording visual state. Recording button triggers handleRecordPress(item) which pauses player and initiates recording for that script item.

**RecordingBar**: Three visual states (hidden/recording/playback). Recording state shows stop button and elapsed time. Playback state shows play/pause button, progress bar, rerecord button, and confirm button. Duration calculated from audio file metadata.

### 6.4 Bug Fixes for Audio Recording

**Bug 1: Playback Position Not Reset**
- Issue: Calling playRecording() on finished playback would resume from end position instead of start
- Fix: Added setPositionAsync(0) call before replay in playRecording() method
- Location: apps/mobile/src/hooks/useAudioRecorder.ts, playRecording() method

**Bug 2: Race Condition in resetRecording**
- Issue: Async cleanup operations (Audio.Recording.stopAndUnloadAsync, Sound.unloadAsync) not awaited
- State reset occurred before cleanup completed, causing audio session still in use errors on next recording
- Fix: Made resetRecording async, added await for cleanupRecording() and cleanupSound() calls
- Updated handleConfirm() and handleReRecord() in shadowing/[videoId].tsx to await resetRecording()
- Location: apps/mobile/src/hooks/useAudioRecorder.ts and apps/mobile/app/shadowing/[videoId].tsx

**Bug 3: crypto.randomUUID() Hermes Incompatibility**
- Issue: crypto.randomUUID() unavailable in some Hermes engine builds
- Affects: apps/mobile/src/lib/transcript-parser.ts and shared package code
- Fix: Added generateId() helper function using crypto.randomUUID() with Math.random() UUID v4 fallback
- Location: packages/shared/src/lib/transcript-parser.ts
- All crypto.randomUUID() calls replaced with generateId() for React Native compatibility

### 6.5 Integration Points

- **studyStore**: updateSessionPhase(sessionId, 'shadowing') called on screen mount
- **appStore**: recordedSentences state tracks per-sentence recordings with hasRecording flag
- **YouTubePlayer**: Shared ref pattern, seekTo() and getCurrentTime() integration
- **expo-av**: Audio.Recording for capture, Audio.Sound for playback
- **shared utilities**: groupSentencesByMode() for script reorganization by learning mode
