# Shadowoo Mobile App - Changelog

All notable changes to the Shadowoo mobile application are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-08

### Added

#### Push Notifications (SPEC-MOBILE-007)

- **expo-notifications Integration** - Added complete push notification support for iOS (APN) and Android (FCM) using expo-notifications
- **Push Token Management** - Implemented automatic push token registration and synchronization with Supabase on app startup
  - `push_notifications.ts`: Core push notification initialization and token handling
  - Automatic token refresh on app launch
  - iOS and Android platform-specific token registration
- **Notification Permissions** - Separated permission request from token retrieval to support simulator testing
  - Users can grant/deny notification permissions on first launch
  - Permission dialog displayed natively on iOS and Android
- **iOS Push Configuration** - Added APN (Apple Push Notification) capability to iOS entitlements
  - `app.json` configured with `ios.entitlements.aps-environment: "production"`
  - Automatic entitlements file generation during iOS prebuild
- **Notification Handling** - Implemented in-app notification display and deep-linking
  - `handleNotificationResponse()` routes users to relevant screens when tapping notifications
  - Support for both foreground and background notification handling
  - Navigation listener configured in `_layout.tsx`
- **Notification Settings UI** - Added user-configurable notification preferences
  - `useNotificationSettings.ts`: MMKV-backed notification setting management
  - Profile screen notification preferences section with three categories:
    - 학습 리마인더 (Learning Reminder)
    - 새 콘텐츠 (New Content)
    - Streak (Continued Learning Streak)
  - Real-time toggle state management and persistence

#### Release Preparation (SPEC-MOBILE-007)

- **Version Management** - Established versioning strategy following Semantic Versioning
  - `app.json` configured with `version: "1.0.0"`
  - iOS buildNumber set to "1"
  - Android versionCode set to 1
  - Single source of truth for version numbers across platforms
- **Release Checklist** - Created comprehensive release checklist document
  - `docs/release-checklist.md` includes real device testing procedures
  - Build configuration verification steps
  - Pre-release quality assurance tasks

### Deferred

#### Push Notifications

- **Learning Reminder Scheduling** (AC-PUSH-004) - Server-side push notification scheduling deferred
  - Reason: Requires server-side implementation (Supabase Edge Functions or notification service)
  - Status: Client-side notification settings implemented; server-side scheduling not yet implemented
  - Scope: User can configure reminder preferences, but server does not yet send scheduled reminders

#### Release Preparation

- **App Store Metadata** (AC-REL-002) - iOS App Store submission metadata preparation deferred
  - Reason: Non-code preparation task assigned to marketing/product team
  - Includes: App description (Korean, English), keywords, category, privacy policy URL, screenshots
- **Play Store Metadata** (AC-REL-003) - Android Play Store submission metadata preparation deferred
  - Reason: Non-code preparation task assigned to marketing/product team
  - Includes: App description (Korean, English), content rating, privacy policy URL, screenshots
- **App Icons and Splash Screen** (AC-REL-006) - Design assets not yet available
  - Reason: Awaiting design team asset delivery
  - Includes: 1024x1024 app icon, Android adaptive icon variants, splash screen image

### Not Yet Started

#### Offline Support (SPEC-MOBILE-007)

- Network connection status detection
- Persistent offline operation queue with MMKV
- Automatic synchronization on network recovery
- Transcript and video metadata caching
- Cache-first data retrieval with stale-while-revalidate pattern
- Conflict resolution using Last-Write-Wins timestamp strategy
- Offline UI indicators and disabled network-dependent features

#### EAS Build and CI/CD

- EAS Build configuration (`eas.json`) with development, preview, and production profiles
- GitHub Actions CI/CD pipeline for automated builds on tag push
- Automated iOS and Android production builds

---

## Architecture Notes

### Push Notification Implementation

**Design Decision: Permission and Token Separation**

- `requestPermission()` and `getToken()` functions are separate
- Allows simulator testing of permission dialogs (real tokens not available on simulator)
- iOS simulator displays permission dialog but cannot issue Expo push tokens
- Production builds on real devices obtain valid tokens for push notification delivery

**Design Decision: MMKV-backed Notification Settings**

- Notification preferences stored locally in MMKV for instant response
- Provides offline-first setting changes
- Future server synchronization can be added without architectural changes
- Reduces backend dependency for user preference management

### File Structure

```
apps/mobile/
├── src/
│   ├── lib/
│   │   └── push-notifications.ts          [NEW]
│   └── hooks/
│       └── useNotificationSettings.ts     [NEW]
├── app/
│   ├── _layout.tsx                        [MODIFIED]
│   └── (tabs)/
│       └── profile.tsx                    [MODIFIED]
├── app.json                               [MODIFIED]
├── docs/
│   └── release-checklist.md               [NEW]
└── CHANGELOG.md                           [NEW]
```

---

## Testing and Quality

### Test Coverage

- New code follows 85%+ test coverage requirement
- Push notification logic validated through unit tests
- Notification settings persistence tested with MMKV

### Quality Gates

- TypeScript type checking: ✅ 0 errors
- ESLint rules: ✅ 0 errors
- LSP diagnostics: ✅ clean

---

## Future Work

### High Priority (Next Sprint)

1. Offline support implementation (separate SPEC)
2. Server-side push notification scheduling (Supabase Edge Functions)
3. EAS Build configuration and GitHub Actions CI/CD

### Medium Priority

1. App Store and Play Store metadata preparation (marketing team)
2. Design assets (app icons, splash screens)
3. Advanced notification categories and rich media support

### Low Priority

1. Analytics integration
2. A/B testing for notification engagement
3. Advanced scheduling (timezone-aware reminders)

---

## Breaking Changes

None.

## Dependencies

- expo-notifications: ^0.21.0 (push notification support)
- react-native-mmkv: ^0.13.x (encrypted preferences storage)
- zustand: ^5.x (state management)

## Contributors

- MoAI System (Documentation sync)
- Development team (Implementation)
