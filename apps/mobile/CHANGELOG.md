# InputEnglish Mobile App - Changelog

All notable changes to the InputEnglish mobile application are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-08

### Added

#### AI Features & RevenueCat Payments (SPEC-MOBILE-006)

**AI Learning Features**

- **AI Tip Generation** - POST `/api/ai-tip` endpoint integration for context-aware learning suggestions
  - `AiTipButton.tsx`: Trigger component with loading state and error handling
  - `AiTipCard.tsx`: Display component for AI-generated tips with metadata
  - `DifficultyTagSelector.tsx`: Multi-select UI for difficulty tags (연음, 문법, 발음, 속도)
  - `ai-api.ts`: Fetch-based HTTP client with timeout protection (30s) and error classification
  - Support for STANDARD and MASTER plan tiers (future expansion ready)

- **AI Analysis & Notes** - Sentence analysis and persistent AI notes storage
  - POST `/api/analyze` endpoint for detailed feedback (analysis, tips, focusPoint)
  - Automatic AI note persistence in appStore and Supabase `ai_notes` table
  - Retrieval of cached tips without redundant API calls
  - Integration with study, listening, and shadowing screens

- **Recording Upload & Pronunciation** - Supabase Storage integration for audio files
  - Upload to `recordings` bucket with path format: `{userId}/{videoId}/{sentenceId}/{timestamp}.m4a`
  - Metadata storage: sentenceId, videoId, duration, fileSize
  - Pronunciation score endpoint stub (awaiting `/api/pronunciation` backend implementation)
  - Error recovery with local file preservation and retry options

**RevenueCat Payment System**

- **SDK Integration** - Complete react-native-purchases setup for iOS/Android
  - `revenue-cat.ts`: Wrapper for SDK initialization, offerings fetch, purchases, restores
  - Platform-specific API keys: `EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`
  - User identification via Supabase Auth UID
  - Non-fatal initialization (graceful degradation on SDK failures)

- **Subscription Management** - Real-time subscription state tracking
  - `useSubscription.ts` hook: Returns `plan` ('FREE'|'PREMIUM'), `canUseAI`, `isLoading`, and `refresh()`
  - Real-time listening to CustomerInfo updates via `addCustomerInfoUpdateListener()`
  - Automatic Supabase `users.plan` sync on entitlement changes
  - Redundant update prevention using cached plan reference

- **Paywall Screen** - Plan comparison and purchase flow
  - `paywall.tsx`: Screen showing FREE vs PREMIUM plans with 3 subscription periods (monthly, quarterly, annual)
  - `PlanCard.tsx`: Visual plan card component with feature lists
  - `PurchaseButton.tsx`: Purchase flow handler with success/error feedback
  - Offerings-based dynamic pricing (fallback prices for missing product data)
  - Purchase restoration flow with "no purchases found" messaging

- **Feature Gating** - AI features restricted to paid plans
  - `canUseAI` boolean gating on all AI components
  - FREE plan users see upgrade prompt and paywall navigation
  - Seamless upgrade flow from any screen to paywall

**Quality & Resilience**

- Error handling for timeouts (30s fetch timeout via AbortController)
- Network error classification (TIMEOUT, NETWORK, API, UPLOAD error types)
- App crash prevention: All AI and RevenueCat failures handled gracefully
- Comprehensive logging for debugging (console.error for all failures)

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

#### AI Features (SPEC-MOBILE-006)

- **AC-AI-006: AI Pronunciation Feedback** - Recording upload complete; pronunciation scoring not yet implemented
  - Reason: Pronunciation scoring requires dedicated `/api/pronunciation` backend endpoint with ML model inference
  - Current State: Supabase Storage recording upload fully functional (R-AI-006 complete)
  - Endpoint Stub: `getPronunciationScore()` in `ai-api.ts` calls `/api/pronunciation` but returns error when endpoint unavailable
  - Next Step: Backend SPEC required for pronunciation analysis model integration
  - Impact: Users can record and upload; advanced pronunciation feedback unavailable until backend ready

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

### AI & Payment System Design (SPEC-MOBILE-006)

**Design Decision: Simplified Plan Model (FREE | PREMIUM)**

- Two-tier model reduces RevenueCat configuration complexity
- Offerings API supports future expansion to STANDARD/MASTER without breaking changes
- Single boolean `canUseAI` gate sufficient for MVP
- Alternative considered: Full 3-tier (FREE, STANDARD, MASTER) rejected for MVP speed

**Design Decision: Plan Sync on Purchase Only**

- Supabase `users.plan` updated immediately after successful purchase
- Expiry handling: RevenueCat SDK triggers `addCustomerInfoUpdateListener()` on expiry
- Expiry sync to Supabase verified to work (initial refresh) but edge-case of auto-expiry not extensively tested
- Alternative rejected: Polling Supabase on app launch (would block startup)

**Design Decision: RevenueCat Non-Fatal Initialization**

- SDK init failure does not crash app (graceful degradation to FREE plan)
- Allows offline app usage even if RevenueCat unavailable
- User can still access free features; premium features blocked
- Alternative rejected: Fail-fast approach (would crash on network issues)

**Design Decision: Fetch-Based AI Client with Timeout**

- Standard fetch API (Expo compatible, no additional dependencies)
- 30-second timeout prevents hanging requests
- AbortController for clean timeout handling
- Error classification (TIMEOUT, NETWORK, API, UPLOAD) for precise debugging
- Alternative rejected: axios (unnecessary dependency)

**Design Decision: AI Notes Cached in appStore**

- appStore (Zustand) provides fast local read access
- Supabase sync happens asynchronously in background
- Eliminates redundant API calls for previously fetched tips
- Alternative rejected: Always fetch from Supabase (slower, higher cost)

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
│   │   ├── ai-api.ts                      [NEW - SPEC-MOBILE-006]
│   │   ├── revenue-cat.ts                 [NEW - SPEC-MOBILE-006]
│   │   └── push-notifications.ts          [NEW - SPEC-MOBILE-007]
│   ├── hooks/
│   │   ├── useSubscription.ts             [NEW - SPEC-MOBILE-006]
│   │   └── useNotificationSettings.ts     [NEW - SPEC-MOBILE-007]
│   ├── components/
│   │   ├── ai/                            [NEW - SPEC-MOBILE-006]
│   │   │   ├── AiTipButton.tsx
│   │   │   ├── AiTipCard.tsx
│   │   │   └── DifficultyTagSelector.tsx
│   │   ├── paywall/                       [NEW - SPEC-MOBILE-006]
│   │   │   ├── PlanCard.tsx
│   │   │   └── PurchaseButton.tsx
│   │   ├── study/
│   │   │   └── HighlightBottomSheet.tsx   [MODIFIED - SPEC-MOBILE-006]
│   │   └── common/                        [NEW - SPEC-MOBILE-006]
│   │       ├── ErrorToast.tsx
│   │       └── UndoToast.tsx
│   └── (store locations)
│       └── app-store.ts                   [MODIFIED - SPEC-MOBILE-006]
├── app/
│   ├── paywall.tsx                        [NEW - SPEC-MOBILE-006]
│   ├── _layout.tsx                        [MODIFIED - SPEC-MOBILE-007]
│   └── (tabs)/
│       └── profile.tsx                    [MODIFIED - SPEC-MOBILE-007]
├── app.json                               [MODIFIED - SPEC-MOBILE-007]
├── docs/
│   └── release-checklist.md               [NEW - SPEC-MOBILE-007]
└── CHANGELOG.md                           [UPDATED]
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

**New in v1.0.0:**

- react-native-purchases: ^8.x (RevenueCat SDK for iOS/Android IAP)
- expo-notifications: ^0.21.0 (push notification support)
- react-native-mmkv: ^0.13.x (encrypted preferences storage)
- zustand: ^5.x (state management)

## Contributors

- MoAI System (Documentation sync)
- Development team (Implementation)
