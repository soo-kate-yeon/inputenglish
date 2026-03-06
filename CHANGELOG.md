# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Mobile App Shell** (SPEC-MOBILE-002): Initialized Expo SDK 52 mobile app in `apps/mobile/`
  - expo-router v4 file-based navigation: (auth) and (tabs) groups with stack routes
  - Supabase auth with expo-secure-store (iOS Keychain / Android Keystore, PKCE)
  - AuthContext: AppState foreground/background management, exponential backoff retry
  - MMKV-backed Zustand stores via @shadowoo/shared factory pattern
  - Email/password auth forms with loading states and error handling
  - OAuth buttons: Google, GitHub, Kakao, Microsoft (via expo-auth-session + PKCE)
  - Route guards via expo-router Redirect in tab layout
  - expo-dev-client for custom development builds with native modules
  - Turborepo pipeline integration (typecheck, build tasks)

## [0.2.0] - 2026-03-01

### Added

- Turborepo monorepo structure with pnpm workspaces (SPEC-MOBILE-001)
- `@shadowoo/shared` package extracting platform-independent code
  - Factory pattern for Zustand stores (`createAppStore`, `createStudyStore`)
  - Supabase client factory (`createSupabaseStore`)
  - Shared TypeScript types and utilities
- `apps/mobile/` placeholder for future Expo React Native app
- `vercel.json` monorepo configuration (`rootDirectory: apps/web`)
- Monorepo verification script (`scripts/verify-monorepo.sh`)

### Changed

- Moved Next.js web app to `apps/web/`
- Root `package.json` updated to monorepo configuration
- Package manager updated to pnpm with Turborepo orchestration
- 20+ import sites updated to use `@shadowoo/shared`

### Fixed

- Duplicate Zustand storage keys resolved (`shadowoo-app-v1`, `shadowoo-study-v1`)
- Debug `console.log` statements removed from transcript-parser
