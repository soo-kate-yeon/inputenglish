---
id: SPEC-MOBILE-007
title: "Offline Support + Push Notifications + Release Preparation"
version: "1.0.0"
status: partially-completed
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
| 1.0.1 | 2026-03-08 | 푸시 알림, 릴리스 설정 구현 완료; 오프라인 지원 및 일부 릴리스 항목 deferred |
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

## 7. Implementation Notes

### 완료된 기능 (Completed)

**푸시 알림 (Push Notifications)**

1. **expo-notifications 설정** (AC-PUSH-001)
   - `apps/mobile/src/lib/push-notifications.ts` 생성
   - `initPushNotifications()`: 앱 시작 시 알림 권한 요청 및 토큰 발급
   - 권한 요청과 토큰 발급을 분리하여 시뮬레이터에서 권한 다이얼로그 테스트 가능하도록 설계

2. **푸시 토큰 동기화** (AC-PUSH-002)
   - `apps/mobile/app/_layout.tsx`에서 로그인 시 자동 토큰 등록
   - Supabase `push_tokens` 테이블에 user_id, token, platform 저장

3. **iOS 푸시 설정** (AC-PUSH-003)
   - `apps/mobile/app.json`에 `ios.entitlements.aps-environment: "production"` 추가
   - iOS 빌드 시 자동으로 entitlements 파일에 포함됨

4. **인앱 알림 처리 및 딥링킹** (AC-PUSH-005)
   - `handleNotificationResponse()`: 알림 수신 시 딥링크로 해당 화면 이동
   - `apps/mobile/app/_layout.tsx`에 notification 리스너 등록

5. **알림 설정 UI** (AC-PUSH-006)
   - `apps/mobile/src/hooks/useNotificationSettings.ts` 생성: MMKV 기반 알림 설정 관리
   - `apps/mobile/app/(tabs)/profile.tsx`에 알림 설정 섹션 추가
     - 학습 리마인더 (학습 리마인더)
     - 새 콘텐츠 알림 (새 콘텐츠)
     - Streak 알림 (Streak)

**릴리스 준비 (Release Preparation)**

1. **버전 관리 전략** (AC-REL-005)
   - `apps/mobile/app.json`에 `version: "1.0.0"`, `ios.buildNumber: "1"`, `android.versionCode: 1` 설정
   - Semantic Versioning(MAJOR.MINOR.PATCH) 준수

2. **릴리스 체크리스트** (추가 생성)
   - `apps/mobile/docs/release-checklist.md` 생성
   - 실제 기기 테스트 항목 및 릴리스 빌드 테스트 항목 포함

### Deferred된 기능 (Deferred)

**푸시 알림**

1. **알림 카테고리 및 서버 사이드 스케줄링** (AC-PUSH-004)
   - 상태: Deferred
   - 사유: 학습 리마인더 알림 발송은 서버 사이드 스케줄링이 필요함 (Supabase Edge Functions 또는 별도 notification service)
   - 클라이언트 알림 설정은 완료되었으나, 서버에서 설정된 시간에 맞춰 푸시 알림을 발송하는 로직은 별도 SPEC으로 분리
   - 영향: 사용자는 프로필에서 알림 설정을 변경할 수 있지만, 서버에서는 아직 이 설정을 활용한 푸시 발송 로직이 미구현

**릴리스 준비**

1. **App Store 메타데이터** (AC-REL-002)
   - 상태: Deferred
   - 사유: 비개발자 작업으로 분류 (마케팅/PM 담당)
   - 포함 항목: 앱 설명, 스크린샷, 개인정보 처리방침 URL

2. **Play Store 메타데이터** (AC-REL-003)
   - 상태: Deferred
   - 사유: 비개발자 작업으로 분류 (마케팅/PM 담당)
   - 포함 항목: 앱 설명, 콘텐츠 등급, 개인정보 처리방침 URL

3. **앱 아이콘/스플래시 스크린** (AC-REL-006)
   - 상태: Deferred
   - 사유: 디자인 에셋이 준비되지 않음
   - 추후 디자인 팀에서 에셋 제공 시 `apps/mobile/assets/` 디렉토리에 추가 및 `app.json` 설정 필요

### 아직 구현되지 않은 기능 (Not Started)

**오프라인 지원 (Offline Support)**

다음 항목들은 현재 구현되지 않았으며, 향후 별도 작업으로 진행 예정:

1. **네트워크 상태 감지** (REQ-OFF-001, AC-OFF-001)
   - `@react-native-community/netinfo` 설치 및 `useNetworkStatus()` hook 생성
   - 네트워크 상태 변경 감지 및 전역 상태 관리

2. **오프라인 큐 영속화** (REQ-OFF-002, AC-OFF-002)
   - `offline-queue.ts`: MMKV 기반 오프라인 작업 큐 관리
   - 문장 완료, 북마크 등 쓰기 작업을 오프라인 큐에 저장

3. **자동 재동기화** (REQ-OFF-003, AC-OFF-003)
   - 네트워크 복구 시 오프라인 큐의 작업을 FIFO 순서로 Supabase에 동기화
   - 재시도 로직 (최대 3회) 및 실패 처리

4. **자막/메타데이터 캐싱** (REQ-OFF-004, AC-OFF-004)
   - `transcript-cache.ts`: 웹의 TranscriptCache 패턴을 모바일에 이식
   - MMKV에 자막 데이터 캐싱 (TTL: 7일)

5. **Cache-First 읽기 패턴** (REQ-OFF-005, AC-OFF-005)
   - 로컬 캐시 우선 조회, 캐시 미스 시 네트워크 요청
   - stale-while-revalidate 패턴으로 백그라운드 갱신

6. **충돌 해결** (REQ-OFF-006, AC-OFF-006)
   - Last-Write-Wins 전략으로 로컬/서버 데이터 충돌 해결
   - 타임스탬프 기반 비교

7. **오프라인 UI 표시** (REQ-OFF-007, AC-OFF-007)
   - 오프라인 상태 배너 표시
   - 네트워크 필요 기능(비디오 재생) 비활성화

### 파일 변경 사항

**생성된 파일:**
- `apps/mobile/src/lib/push-notifications.ts`: 푸시 알림 초기화 및 핸들러
- `apps/mobile/src/hooks/useNotificationSettings.ts`: MMKV 기반 알림 설정 hook
- `apps/mobile/docs/release-checklist.md`: 릴리스 체크리스트

**수정된 파일:**
- `apps/mobile/app/_layout.tsx`: 푸시 토큰 등록 및 notification listener
- `apps/mobile/app/(tabs)/profile.tsx`: 알림 설정 UI 추가
- `apps/mobile/app.json`: 버전, buildNumber, versionCode, iOS entitlements 설정
- `apps/mobile/src/lib/ai-api.ts`: Gemini 모델 업데이트 관련 변경

### 설계 결정 (Design Decisions)

**권한 요청과 토큰 발급 분리**

iOS 시뮬레이터에서는 실제 Expo 푸시 토큰을 발급할 수 없지만, 권한 다이얼로그는 표시됩니다. 따라서:
- `requestPermission()`: 알림 권한 요청 다이얼로그 표시
- `getToken()`: 토큰 발급 시도 (기기에서만 성공, 시뮬레이터에서는 null)
- 시뮬레이터에서 권한 다이얼로그 테스트 시 `requestPermission()` 만 호출 가능

**MMKV 기반 알림 설정**

Supabase에 사용자별 알림 설정을 저장할 수도 있지만, 로컬 MMKV에 저장하여:
- 빠른 토글 응답성 (로컬 먼저 업데이트)
- 오프라인 지원
- 나중에 서버 동기화 추가 가능 (향후 작업)

### 다음 단계 (Next Steps)

1. **오프라인 지원 구현** (별도 SPEC 또는 SPEC-MOBILE-007 확장)
   - 네트워크 상태 감지
   - 오프라인 큐 및 자동 동기화
   - 자막 캐싱 및 cache-first 읽기

2. **서버 사이드 푸시 알림 로직** (별도 SPEC)
   - Supabase Edge Functions으로 사용자의 알림 설정에 맞춰 푸시 발송
   - 학습 리마인더 스케줄링

3. **릴리스 자동화** (추가 구현)
   - `eas.json` 설정 (development, preview, production 프로필)
   - GitHub Actions CI/CD 워크플로우 (태그 푸시 시 EAS Build 트리거)

4. **디자인 에셋 준비** (디자인 팀)
   - 앱 아이콘 (1024x1024)
   - Android adaptive icon
   - 스플래시 스크린 이미지

---

## 8. Traceability

| 요구사항 ID | 파일 | 상태 | 테스트 시나리오 |
|-------------|------|------|-----------------|
| REQ-OFF-001 | `network-monitor.ts`, `useNetworkStatus.ts` | Not Started | AC-OFF-001 |
| REQ-OFF-002 | `offline-queue.ts` | Not Started | AC-OFF-002 |
| REQ-OFF-003 | `useOfflineSync.ts` | Not Started | AC-OFF-003 |
| REQ-OFF-004 | `transcript-cache.ts` | Not Started | AC-OFF-004 |
| REQ-OFF-005 | `transcript-cache.ts` | Not Started | AC-OFF-005 |
| REQ-OFF-006 | `offline-queue.ts` | Not Started | AC-OFF-006 |
| REQ-OFF-007 | UI 컴포넌트 | Not Started | AC-OFF-007 |
| REQ-OFF-008 | - | Compliance | AC-OFF-008 |
| REQ-PUSH-001 | `push-notifications.ts` | Completed | AC-PUSH-001 |
| REQ-PUSH-002 | `push-notifications.ts` | Completed | AC-PUSH-002 |
| REQ-PUSH-003 | iOS 설정 파일 | Completed | AC-PUSH-003 |
| REQ-PUSH-004 | `push-notifications.ts` | Deferred (Server-side) | AC-PUSH-004 |
| REQ-PUSH-005 | `push-notifications.ts` | Completed | AC-PUSH-005 |
| REQ-PUSH-006 | `NotificationPreferences.tsx` | Completed | AC-PUSH-006 |
| REQ-REL-001 | `eas.json` | Not Started | AC-REL-001 |
| REQ-REL-002 | App Store 메타데이터 | Deferred (Non-code) | AC-REL-002 |
| REQ-REL-003 | Play Store 메타데이터 | Deferred (Non-code) | AC-REL-003 |
| REQ-REL-004 | `deploy-mobile.yml` | Not Started | AC-REL-004 |
| REQ-REL-005 | `app.json` | Completed | AC-REL-005 |
| REQ-REL-006 | 에셋 파일 | Deferred (Design assets) | AC-REL-006 |
