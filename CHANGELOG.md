# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Audio recording hook with expo-av (M4A/AAC format) supporting idle/recording/playback state machine (SPEC-MOBILE-004)
- Shadowing screen with per-sentence recording, playback, and mode toggle (sentence/paragraph/total)
- RecordingBar component with recording duration display and playback progress tracking
- ShadowingHeader component with mode selection and study completion
- Microphone permission handling with user feedback alerts
- Background handling to pause recording and player on app backgrounding
- YouTube player component with `react-native-youtube-iframe` (SPEC-MOBILE-003)
- Listening screen with subtitle synchronization, loop repeat, speed control
- Sentence save/unsave with Supabase sync
- Home tab curated video list with difficulty badges
- Supabase direct query API client for mobile
- Database migrations for `curated_videos` table and RLS policies

### Changed

### Deprecated

### Removed

### Fixed

- Audio recording playback now resets position before replay (SPEC-MOBILE-004)
- Recording state properly cleaned up before reset to prevent race conditions and audio session locks (SPEC-MOBILE-004)
- crypto.randomUUID() replaced with generateId() helper for React Native Hermes compatibility (SPEC-MOBILE-004)

### Security
