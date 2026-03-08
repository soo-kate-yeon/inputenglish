---
id: SPEC-MOBILE-007
title: "Offline Support + Push Notifications + Release Preparation"
version: "1.0.0"
status: planned
created: "2026-03-08"
updated: "2026-03-08"
author: MoAI
priority: P1
dependencies:
  - SPEC-MOBILE-005
parallel:
  - SPEC-MOBILE-006
tags:
  - offline
  - push-notifications
  - release
  - mobile
---

# SPEC-MOBILE-007: Offline Support + Push Notifications + Release Preparation

## HISTORY

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0.0 | 2026-03-08 | 초기 SPEC 작성 |

---

## 1. Overview

Shadowoo 모바일 앱에 오프라인 지원, 푸시 알림, 릴리스 준비를 추가한다. 이 SPEC은 Phase 6에 해당하며 SPEC-MOBILE-006과 병렬 진행 가능하다.

### 배경
- 현재 앱은 네트워크 끊김 시 데이터 손실 위험이 있음
- `pendingSentenceOps`가 존재하나 자동 동기화 미구현
- 푸시 알림 미구현으로 학습 리마인더 불가
- EAS Build/App Store 배포 파이프라인 부재

---

## 2. Environment

- **플랫폼**: iOS 15.1+, Android (Expo SDK 52+)
- **런타임**: React Native 0.76.3, New Architecture 활성화
- **상태 관리**: Zustand 5 + MMKV 영속화
- **백엔드**: Supabase (PostgreSQL, Auth, Storage)
- **빌드**: Expo prebuild, EAS Build (신규)
- **모노레포**: Turborepo + pnpm, `packages/shared`

---

## 3. Assumptions

- A1: `@react-native-community/netinfo`가 iOS/Android 모두에서 안정적으로 동작한다
- A2: Supabase에 push_tokens 테이블을 추가할 수 있다
- A3: Apple Developer Program 및 Google Play Console 계정이 활성화되어 있다
- A4: expo-notifications가 Expo SDK 52+와 호환된다
- A5: 사용자는 오프라인 상태에서도 이전에 캐싱된 자막/메타데이터를 조회할 수 있어야 한다
- A6: YouTube iframe 재생은 항상 네트워크 연결이 필요하다 (YouTube ToS)

---

## 4. Requirements

### 4.1 오프라인 지원

#### REQ-OFF-001: 네트워크 상태 감지 (Event-Driven)
**WHEN** 네트워크 연결 상태가 변경되면 **THEN** 시스템은 앱 전체에 연결 상태를 즉시 전파해야 한다.

#### REQ-OFF-002: 오프라인 큐 영속화 (Ubiquitous)
시스템은 **항상** 모든 쓰기 작업(문장 완료, 북마크, 설정 변경)을 MMKV 기반 오프라인 큐에 영속화해야 한다.

#### REQ-OFF-003: 자동 재동기화 (Event-Driven)
**WHEN** 네트워크가 오프라인에서 온라인으로 전환되면 **THEN** 시스템은 오프라인 큐의 미동기화 작업을 자동으로 Supabase에 동기화해야 한다.

#### REQ-OFF-004: 자막/메타데이터 캐싱 (State-Driven)
**IF** 사용자가 비디오 자막을 조회한 적이 있으면 **THEN** 시스템은 해당 자막과 메타데이터를 MMKV에 캐싱하여 오프라인에서도 조회 가능하게 해야 한다.

#### REQ-OFF-005: Cache-First 읽기 패턴 (Ubiquitous)
시스템은 **항상** 자막/비디오 메타데이터 조회 시 로컬 캐시를 먼저 확인하고, 캐시 미스 시에만 네트워크 요청을 수행해야 한다.

#### REQ-OFF-006: 충돌 해결 (Event-Driven)
**WHEN** 동기화 시 서버 데이터와 로컬 데이터가 충돌하면 **THEN** 시스템은 타임스탬프 기반 Last-Write-Wins 전략으로 충돌을 해결해야 한다.

#### REQ-OFF-007: 오프라인 UI 표시 (State-Driven)
**IF** 네트워크가 오프라인 상태이면 **THEN** 시스템은 사용자에게 오프라인 상태를 시각적으로 표시하고, 네트워크 필요 기능(비디오 재생)을 비활성화해야 한다.

#### REQ-OFF-008: 비디오 다운로드 금지 (Unwanted)
시스템은 YouTube 비디오를 로컬에 다운로드 **하지 않아야 한다** (YouTube ToS 준수).

### 4.2 푸시 알림

#### REQ-PUSH-001: expo-notifications 설정 (Ubiquitous)
시스템은 **항상** expo-notifications를 통해 iOS(APN) 및 Android(FCM) 푸시 알림을 지원해야 한다.

#### REQ-PUSH-002: 푸시 토큰 동기화 (Event-Driven)
**WHEN** 앱이 시작되거나 푸시 토큰이 갱신되면 **THEN** 시스템은 Supabase `push_tokens` 테이블에 토큰을 저장/갱신해야 한다.

#### REQ-PUSH-003: iOS 푸시 설정 (Ubiquitous)
시스템은 **항상** iOS `.entitlements`에 push capability를 포함하고 APN 인증서를 설정해야 한다.

#### REQ-PUSH-004: 알림 카테고리 (Optional)
**가능하면** 학습 리마인더, 새 콘텐츠 알림, 연속 학습(streak) 알림 카테고리를 제공한다.

#### REQ-PUSH-005: 인앱 알림 처리 (Event-Driven)
**WHEN** 푸시 알림이 수신되면 **THEN** 시스템은 인앱에서 알림을 표시하고 해당 화면으로 딥링킹해야 한다.

#### REQ-PUSH-006: 알림 설정 UI (State-Driven)
**IF** 사용자가 프로필 화면에서 알림 설정에 접근하면 **THEN** 시스템은 카테고리별 알림 on/off 토글을 제공해야 한다.

### 4.3 릴리스 준비

#### REQ-REL-001: EAS Build 설정 (Ubiquitous)
시스템은 **항상** `eas.json`에 development, preview, production 프로필을 포함해야 한다.

#### REQ-REL-002: App Store 메타데이터 (Ubiquitous)
시스템은 **항상** App Store 제출에 필요한 설명, 스크린샷 placeholder, 개인정보 처리방침 URL을 준비해야 한다.

#### REQ-REL-003: Play Store 메타데이터 (Ubiquitous)
시스템은 **항상** Play Store 제출에 필요한 설명, 스크린샷 placeholder, 콘텐츠 등급을 준비해야 한다.

#### REQ-REL-004: CI/CD 파이프라인 (Event-Driven)
**WHEN** `main` 브랜치에 태그가 푸시되면 **THEN** GitHub Actions가 EAS Build를 트리거하여 iOS/Android 빌드를 생성해야 한다.

#### REQ-REL-005: 버전 관리 전략 (Ubiquitous)
시스템은 **항상** Semantic Versioning(MAJOR.MINOR.PATCH)을 따르고, `app.json`의 version과 buildNumber/versionCode를 일관되게 관리해야 한다.

#### REQ-REL-006: 앱 아이콘/스플래시 (Ubiquitous)
시스템은 **항상** 플랫폼별 앱 아이콘 및 스플래시 스크린 에셋을 포함해야 한다.

---

## 5. Scope

### In Scope
- 네트워크 상태 감지 (`@react-native-community/netinfo`)
- 영속 오프라인 큐 (MMKV 기반, `pendingSentenceOps` 확장)
- 재연결 시 자동 동기화
- 자막/비디오 메타데이터 캐싱 (MMKV, 웹 TranscriptCache 패턴 이식)
- Cache-first 읽기 (stale-while-revalidate)
- 충돌 해결 (Last-Write-Wins, 타임스탬프)
- expo-notifications 설정 및 푸시 토큰 관리
- iOS APN / Android FCM 설정
- 알림 카테고리 및 인앱 처리
- 알림 설정 UI (Profile 화면)
- `eas.json` 설정 (development, preview, production)
- App Store / Play Store 메타데이터 준비
- GitHub Actions 모바일 빌드 워크플로우
- 버전 관리 전략
- 앱 아이콘/스플래시 스크린

### Out of Scope
- 오프라인 비디오 재생 (YouTube ToS 제한)
- 서버 사이드 푸시 알림 로직 (Supabase Edge Functions - 별도 SPEC)
- App Store 심사 제출 (수동 프로세스)
- 분석/Analytics 연동 (별도 SPEC)

---

## 6. Technical Design

### 6.1 오프라인 아키텍처

```
[UI Layer]
    |
[useNetworkStatus] ──> NetworkMonitor (netinfo)
    |
[useOfflineSync] ──> OfflineQueue (MMKV)
    |                      |
[Zustand Store] ──> [TranscriptCache (MMKV)]
    |
[Supabase Client] <── 온라인 시 자동 동기화
```

**OfflineQueue 설계:**
- MMKV에 `offline_queue` 키로 작업 배열 영속화
- 각 작업: `{ id, type, payload, timestamp, retryCount }`
- 동기화 순서: FIFO (First-In-First-Out)
- 실패 시 최대 3회 재시도, 이후 사용자에게 알림

**TranscriptCache 설계:**
- 웹 `TranscriptCache` 패턴 이식
- MMKV 사용 (sessionStorage 대체)
- TTL: 7일 (모바일은 웹보다 긴 TTL)
- 캐시 키: `transcript_{videoId}`
- 최대 캐시 크기: 50MB (LRU 방출)

### 6.2 푸시 알림 아키텍처

```
[expo-notifications]
    |
[push-notifications.ts] ──> 토큰 등록
    |                            |
[NotificationHandler] ──> [Supabase push_tokens]
    |
[DeepLinking] ──> 해당 화면 이동
```

**Supabase 테이블 스키마:**
```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform)
);
```

### 6.3 EAS Build 설정

```json
{
  "cli": { "version": ">= 14.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "...", "ascAppId": "..." },
      "android": { "serviceAccountKeyPath": "..." }
    }
  }
}
```

---

## 7. Traceability

| 요구사항 ID | 파일 | 테스트 시나리오 |
|-------------|------|-----------------|
| REQ-OFF-001 | `network-monitor.ts`, `useNetworkStatus.ts` | AC-OFF-001 |
| REQ-OFF-002 | `offline-queue.ts` | AC-OFF-002 |
| REQ-OFF-003 | `useOfflineSync.ts` | AC-OFF-003 |
| REQ-OFF-004 | `transcript-cache.ts` | AC-OFF-004 |
| REQ-OFF-005 | `transcript-cache.ts` | AC-OFF-005 |
| REQ-OFF-006 | `offline-queue.ts` | AC-OFF-006 |
| REQ-OFF-007 | UI 컴포넌트 | AC-OFF-007 |
| REQ-OFF-008 | - | AC-OFF-008 |
| REQ-PUSH-001 | `push-notifications.ts` | AC-PUSH-001 |
| REQ-PUSH-002 | `push-notifications.ts` | AC-PUSH-002 |
| REQ-PUSH-003 | iOS 설정 파일 | AC-PUSH-003 |
| REQ-PUSH-004 | `push-notifications.ts` | AC-PUSH-004 |
| REQ-PUSH-005 | `push-notifications.ts` | AC-PUSH-005 |
| REQ-PUSH-006 | `NotificationPreferences.tsx` | AC-PUSH-006 |
| REQ-REL-001 | `eas.json` | AC-REL-001 |
| REQ-REL-002 | App Store 메타데이터 | AC-REL-002 |
| REQ-REL-003 | Play Store 메타데이터 | AC-REL-003 |
| REQ-REL-004 | `deploy-mobile.yml` | AC-REL-004 |
| REQ-REL-005 | `app.json` | AC-REL-005 |
| REQ-REL-006 | 에셋 파일 | AC-REL-006 |
