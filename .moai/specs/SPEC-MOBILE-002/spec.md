---
id: SPEC-MOBILE-002
version: "1.0.0"
status: completed
created: "2026-03-01"
updated: "2026-03-01"
author: MoAI
priority: P1
---

# SPEC-MOBILE-002: Expo Shell + Supabase Auth for Shadowoo Mobile App

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-03-01 | MoAI | Initial SPEC creation |

---

## 1. Overview

### Context

Shadowoo는 YouTube 기반 영어 쉐도잉/리스닝 학습 플랫폼이다. SPEC-MOBILE-001에서 Turborepo 모노레포 구조로 전환이 완료되었으며, `packages/shared/`에 플랫폼 독립적인 코드가 추출되었다. 현재 `apps/mobile/`은 `package.json`만 존재하는 빈 placeholder 상태이다.

### Goal

- `apps/mobile/`에 Expo SDK 52+ 프로젝트를 초기화한다
- expo-router 기반 파일 기반 라우팅으로 탭/스택 네비게이션을 구성한다
- Supabase 인증 시스템을 모바일에 맞게 구현한다 (expo-secure-store + expo-auth-session)
- `@shadowoo/shared`의 store factory와 type을 모바일에서 활용한다
- 인증된 사용자만 보호된 화면에 접근할 수 있도록 route guard를 구현한다

### Dependencies

- SPEC-MOBILE-001 (completed): Turborepo monorepo + @shadowoo/shared 패키지

---

## 2. Requirements (EARS Format)

### 2.1 Ubiquitous Requirements (REQ-U)

**REQ-U-001:** 모바일 앱은 Expo SDK 52 이상을 사용하여 TypeScript strict 모드로 개발되어야 한다 (SHALL).

**REQ-U-002:** 네비게이션은 expo-router v4를 사용한 파일 기반 라우팅으로 구현되어야 한다 (SHALL).

**REQ-U-003:** 모든 공유 타입, 유틸리티, store factory는 `@shadowoo/shared` 패키지에서 import하여 사용해야 한다 (SHALL).

**REQ-U-004:** Supabase 클라이언트는 `@supabase/supabase-js` v2를 사용하여 초기화되어야 한다 (SHALL).

**REQ-U-005:** 모바일 앱은 Turborepo 파이프라인(`pnpm build`, `pnpm dev`)에 통합되어야 한다 (SHALL).

### 2.2 Event-Driven Requirements (REQ-E)

**REQ-E-001:** WHEN 사용자가 이메일/비밀번호로 로그인하면, THEN `supabase.auth.signInWithPassword()`가 호출되고 세션이 expo-secure-store에 저장되어야 한다 (SHALL).

**REQ-E-002:** WHEN OAuth 제공자(Google, GitHub, Kakao, Azure)로 인증 요청하면, THEN expo-auth-session을 통해 인증 흐름이 시작되고 deep link 콜백으로 세션이 설정되어야 한다 (SHALL).

**REQ-E-003:** WHEN Supabase에서 `TOKEN_REFRESHED` 이벤트가 발생하면, THEN AuthContext의 user/session 상태가 자동으로 갱신되어야 한다 (SHALL).

**REQ-E-004:** WHEN 사용자가 로그아웃하면, THEN expo-secure-store의 토큰이 삭제되고 로그인 화면으로 리디렉트되어야 한다 (SHALL).

**REQ-E-005:** WHEN 앱이 백그라운드에서 포그라운드로 전환되면, THEN 세션 유효성을 검증하고 필요시 토큰을 갱신해야 한다 (SHALL).

### 2.3 State-Driven Requirements (REQ-S)

**REQ-S-001:** WHILE 앱이 실행 중인 동안, 인증 상태(user, session, isLoading, isAuthenticated)는 AuthContext를 통해 전역적으로 관리되어야 한다 (SHALL).

**REQ-S-002:** WHILE 유효한 세션이 존재하는 동안, 보호된 화면(Archive, Profile, Study, Listening, Shadowing)에 접근이 허용되어야 한다 (SHALL).

**REQ-S-003:** WHILE 앱이 오프라인인 동안, 이전에 캐시된 사용자 데이터는 MMKV를 통해 접근 가능해야 한다 (SHALL).

**REQ-S-004:** WHILE 인증 초기화가 진행 중인 동안, 스플래시 화면 또는 로딩 상태가 표시되어야 한다 (SHALL).

### 2.4 Unwanted Behavior Requirements (REQ-N)

**REQ-N-001:** 모바일 앱은 `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` 등 서버 전용 키를 포함하거나 노출해서는 안 된다 (SHALL NOT).

**REQ-N-002:** 인증 토큰을 AsyncStorage 또는 평문(plaintext)으로 저장해서는 안 된다 (SHALL NOT). 반드시 expo-secure-store를 사용해야 한다.

**REQ-N-003:** 인증되지 않은 사용자가 보호된 화면에 직접 접근할 수 없어야 한다 (SHALL NOT).

**REQ-N-004:** OAuth 콜백 처리 시 CSRF 공격에 취약한 상태로 방치해서는 안 된다 (SHALL NOT). PKCE 코드 검증을 사용해야 한다.

### 2.5 Complex Requirements (REQ-C)

**REQ-C-001:** IF 사용자가 OAuth 제공자를 선택하면, THEN expo-auth-session이 시스템 브라우저를 열고, AND deep link(`shadowoo://auth/callback`)을 통해 인증 코드를 수신하고, AND `exchangeCodeForSession()`으로 세션을 설정해야 한다 (SHALL).

**REQ-C-002:** IF 토큰 갱신이 실패하면 (네트워크 오류 또는 refresh token 만료), THEN exponential backoff로 최대 3회 재시도하고, AND 모든 재시도가 실패하면 로그인 화면으로 리디렉트해야 한다 (SHALL).

**REQ-C-003:** IF `@shadowoo/shared`의 `createAppStore`를 사용하면, THEN 모바일 Supabase 클라이언트와 `getCurrentUserId` 함수를 주입하고, AND `createStudyStore`에는 MMKV 기반 `StateStorage` 어댑터를 주입해야 한다 (SHALL).

**REQ-C-004:** IF 앱을 종료했다가 다시 실행하면, THEN expo-secure-store에서 세션을 복원하고, AND Supabase `getSession()`으로 유효성을 검증하고, AND 유효한 경우 이전 인증 상태를 복원해야 한다 (SHALL).

---

## 3. Scope

### In Scope

- Expo SDK 52+ 프로젝트 초기화 (`apps/mobile/`)
- expo-router v4 기반 탭/스택 네비게이션 구성
- Supabase 클라이언트 초기화 (모바일 전용, expo-secure-store 어댑터)
- 이메일/비밀번호 로그인 및 회원가입 화면
- OAuth 로그인 (Google, GitHub, Kakao, Azure) via expo-auth-session
- AuthContext 포팅 (웹 AuthContext.tsx 기반, 모바일 적응)
- Zustand store 통합 (MMKV 어댑터 + @shadowoo/shared factory)
- 보호된 라우트 가드 (인증 필수 화면 접근 제어)
- Turborepo 파이프라인 통합

### Out of Scope

- YouTube 플레이어 구현 (SPEC-MOBILE-003)
- 오디오 녹음 기능 (SPEC-MOBILE-004)
- 학습 화면 UI 구현 (Study, Listening, Shadowing 화면 내부 컨텐츠)
- AI 기능 및 결제 (SPEC-MOBILE-006)
- 오프라인 모드 전체 구현 (SPEC-MOBILE-007)
- Admin 패널 (웹 전용)
- CI/CD 파이프라인 구성
- 앱 스토어 배포

---

## 4. Technical Design

### 4.1 Expo 프로젝트 구조

```
apps/mobile/
  app.json                    (Expo 설정 - scheme, plugins)
  app/
    _layout.tsx               (Root layout - AuthProvider, store 초기화)
    (auth)/
      _layout.tsx             (Auth group layout - 비인증 전용)
      login.tsx               (로그인 화면)
      signup.tsx              (회원가입 화면)
    (tabs)/
      _layout.tsx             (Tab navigator layout)
      index.tsx               (Home 탭 - 학습 목록)
      archive.tsx             (Archive 탭 - 보관함)
      profile.tsx             (Profile 탭 - 프로필)
    study/
      [videoId].tsx           (Study 화면 - stack)
    listening/
      [videoId].tsx           (Listening 화면 - stack)
    shadowing/
      [videoId].tsx           (Shadowing 화면 - stack)
  src/
    contexts/
      AuthContext.tsx          (모바일용 AuthProvider - expo-secure-store 기반)
    lib/
      supabase.ts             (모바일 Supabase 클라이언트 - SecureStore 어댑터)
      stores.ts               (모바일 store 인스턴스 - MMKV 어댑터)
      mmkv.ts                 (MMKV 초기화 및 StateStorage 어댑터)
    components/
      auth/
        LoginForm.tsx          (이메일/비밀번호 로그인 폼)
        SignupForm.tsx         (회원가입 폼)
        OAuthButtons.tsx       (OAuth 제공자 버튼 - Google, GitHub, Kakao, Azure)
      navigation/
        ProtectedRoute.tsx     (인증 가드 컴포넌트)
    constants/
      config.ts               (환경변수, URL 설정)
  package.json
  tsconfig.json
  babel.config.js
  metro.config.js
```

### 4.2 Authentication Flow

#### 4.2.1 Supabase 클라이언트 초기화

웹에서는 `@supabase/ssr`의 cookie 기반 클라이언트를 사용하지만, 모바일에서는 `@supabase/supabase-js`에 expo-secure-store 어댑터를 주입하여 토큰을 안전하게 저장한다.

- 참조: 웹 클라이언트 `apps/web/src/utils/supabase/client.ts` (26 lines, singleton 패턴)
- 모바일: `createClient(URL, ANON_KEY, { auth: { storage: ExpoSecureStoreAdapter, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })`

#### 4.2.2 이메일/비밀번호 인증

- 참조: 웹 서버 액션 `apps/web/src/app/auth/actions.ts` (login, signup)
- 모바일: `supabase.auth.signInWithPassword()` / `supabase.auth.signUp()` 직접 호출
- 서버 액션 없이 클라이언트에서 직접 Supabase Auth API 사용

#### 4.2.3 OAuth 인증

- 참조: 웹 `apps/web/src/components/auth/LoginButton.tsx` (signInWithOAuth + redirect)
- 모바일: expo-auth-session으로 시스템 브라우저 열기 -> deep link 콜백 수신
- URL scheme: `shadowoo://auth/callback`
- PKCE flow 사용 (Supabase 기본 지원)

#### 4.2.4 AuthContext 포팅

- 참조: 웹 `apps/web/src/contexts/AuthContext.tsx` (213 lines)
- 포팅 범위:
  - 동일: user/session/isLoading/error 상태, onAuthStateChange 구독, TOKEN_REFRESHED 처리, exponential backoff 재시도
  - 변경: Supabase 클라이언트 초기화 방식 (cookie -> secure store)
  - 변경: `useRequireAuth` hook에서 `window.location.href` 대신 expo-router의 `router.replace()` 사용
  - 추가: AppState 변경 감지 (background -> foreground 시 세션 검증)

### 4.3 Navigation Structure

expo-router v4의 파일 기반 라우팅을 사용하며, 다음과 같은 그룹 구조로 구성한다:

- **(auth) group**: 비인증 사용자 전용 (로그인, 회원가입)
- **(tabs) group**: 인증된 사용자 전용 (Home, Archive, Profile)
- **study/listening/shadowing**: Stack 화면 (인증 필수)

Route guard는 root `_layout.tsx`에서 AuthContext의 `isAuthenticated` 상태를 확인하여, 비인증 사용자를 `(auth)/login`으로 리디렉트한다.

참조: 웹 라우트 매핑 (research.md Section 5)

| 웹 라우트 | 모바일 화면 | 탭 | 인증 |
|-----------|------------|-----|------|
| /home | (tabs)/index | Home | Public |
| /archive | (tabs)/archive | Archive | Protected |
| /profile | (tabs)/profile | Profile | Protected |
| /study/[videoId] | study/[videoId] | Stack | Protected |
| /listening/[videoId] | listening/[videoId] | Stack | Protected |
| /shadowing/[videoId] | shadowing/[videoId] | Stack | Protected |

### 4.4 Store Integration

#### 4.4.1 MMKV Adapter

`react-native-mmkv`를 Zustand의 `StateStorage` 인터페이스에 맞게 래핑하여 `createStudyStore`에 주입한다.

- 참조: `packages/shared/src/store/study-store.ts` - `createStudyStore(storage?: StateStorage)` (persistence key: "shadowoo-study-v1")
- MMKV adapter: `getItem(name)`, `setItem(name, value)`, `removeItem(name)` 구현

#### 4.4.2 App Store 초기화

- 참조: `packages/shared/src/store/app-store.ts` - `createAppStore(supabaseClient, getCurrentUserId)` (persistence key: "shadowoo-app-v1")
- 참조: 웹 인스턴스화 `apps/web/src/lib/stores.ts`
- 모바일: 모바일 Supabase 클라이언트와 모바일용 `getCurrentUserId` 함수를 주입

### 4.5 Supabase Client (Mobile-Specific)

모바일 Supabase 클라이언트의 차이점:

| 항목 | 웹 (`@supabase/ssr`) | 모바일 (`@supabase/supabase-js`) |
|------|---------------------|--------------------------------|
| 토큰 저장 | HTTP Cookie | expo-secure-store |
| 토큰 갱신 | Middleware (매 요청) | onAuthStateChange (자동) |
| SSR 지원 | 있음 (서버 클라이언트) | 없음 (클라이언트만) |
| OAuth 콜백 | URL redirect (/auth/callback) | Deep link (shadowoo://auth/callback) |
| 세션 감지 | detectSessionInUrl: true | detectSessionInUrl: false |

환경변수:
- `EXPO_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL (public)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key (public)

---

## 5. Acceptance Criteria

### AC-001: Expo 프로젝트 빌드

- `apps/mobile/`에서 `npx expo start`로 개발 서버가 정상 시작된다
- `pnpm build` (루트)에서 모바일 앱 빌드가 오류 없이 완료된다
- TypeScript strict 모드에서 타입 오류가 없다

### AC-002: 이메일/비밀번호 인증

- 이메일과 비밀번호로 회원가입 후 자동 로그인된다
- 이메일과 비밀번호로 로그인하면 세션이 생성되고 홈 탭으로 이동한다
- 잘못된 자격 증명으로 로그인 시 에러 메시지가 표시된다

### AC-003: OAuth 인증

- 4개 OAuth 제공자(Google, GitHub, Kakao, Azure) 버튼이 표시된다
- OAuth 버튼 클릭 시 시스템 브라우저에서 인증 페이지가 열린다
- 인증 완료 후 deep link를 통해 앱으로 복귀하고 세션이 설정된다

### AC-004: 세션 지속성

- 앱을 완전히 종료하고 다시 열면 이전 세션이 복원된다
- 토큰이 expo-secure-store에 암호화되어 저장된다
- 로그아웃하면 secure store의 토큰이 완전히 삭제된다

### AC-005: 네비게이션

- 3개 탭(Home, Archive, Profile)이 하단에 표시된다
- Home 탭에서 학습 콘텐츠 목록으로 이동한다
- 인증되지 않은 상태에서 보호된 탭 접근 시 로그인 화면으로 리디렉트된다

### AC-006: Store 통합

- `@shadowoo/shared`의 `createAppStore`가 모바일 Supabase 클라이언트로 정상 동작한다
- `createStudyStore`가 MMKV 어댑터로 데이터를 영속화한다
- `@shadowoo/shared`의 타입(Sentence, Session 등)이 정상적으로 import된다

### AC-007: 보안

- `SUPABASE_SERVICE_ROLE_KEY`가 모바일 코드에 포함되지 않는다
- 인증 토큰이 plaintext로 저장되지 않는다 (expo-secure-store 사용 확인)
- OAuth flow에서 PKCE가 적용된다

---

## 6. Implementation Notes

- **Implementation date:** 2026-03-01
- **Commits:** e5b12db, 6492d5e, aff4590
- **Branch:** feat/spec-mobile-001
- **Files created:** 25 new files in apps/mobile/

### Key Divergences from Plan

| Item | Planned | Actual | Reason |
|------|---------|--------|--------|
| ProtectedRoute.tsx | Component file | Not created | expo-router Redirect used directly in layouts instead |
| expo-dev-client | Not planned | Added | Required for react-native-mmkv in custom dev builds |
| react/react-dom version | 18.3.2 | 18.3.1 | 18.3.2 didn't exist in npm |
| @types/react-native | Included | Removed | React Native 0.71+ bundles types |

### Acceptance Criteria Results

All 7 Acceptance Criteria (AC-001 through AC-007) satisfied.

### Security Audit

Clean: no SERVICE_ROLE_KEY, PKCE enabled, expo-secure-store used.
