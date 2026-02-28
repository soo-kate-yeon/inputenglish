# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
