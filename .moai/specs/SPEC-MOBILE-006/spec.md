---
id: SPEC-MOBILE-006
version: "1.0.0"
status: planned
created: "2026-03-08"
updated: "2026-03-08"
author: MoAI
priority: P1
dependencies:
  - SPEC-MOBILE-004
  - SPEC-MOBILE-005
parallel:
  - SPEC-MOBILE-007
tags:
  - ai
  - payments
  - revenueCat
  - subscription
---

# SPEC-MOBILE-006: AI Features + RevenueCat Payments

## HISTORY

| 날짜 | 버전 | 변경 내용 |
|------|------|-----------|
| 2026-03-08 | 1.0.0 | 초기 SPEC 작성 |

---

## 1. Overview

Shadowoo 모바일 앱에 AI 학습 기능과 RevenueCat 기반 구독 결제 시스템을 통합한다. AI 기능은 웹 API 엔드포인트를 통해 Gemini 모델에 접근하며, RevenueCat SDK로 Apple/Google 구독을 관리하고 Supabase `users.plan` 컬럼과 동기화한다.

### 1.1 목표
- 모바일에서 AI 학습 팁 생성 및 표시
- 녹음 파일 서버 업로드 및 기본 AI 발음 피드백
- RevenueCat 기반 구독 결제 시스템 구축
- 플랜 티어별 기능 게이팅

### 1.2 배경
- 웹에는 이미 `/api/ai-tip`, `/api/analyze` 엔드포인트 존재
- `ai_notes` 테이블과 CRUD 작업이 Supabase와 appStore에 구현됨
- 결제 시스템은 그린필드 구현 (기존 코드 없음)

---

## 2. Environment

- **플랫폼**: iOS/Android (Expo SDK 52+, React Native 0.76.3)
- **언어**: TypeScript 5.7
- **상태관리**: Zustand 5
- **백엔드**: Supabase (PostgreSQL, Storage, Auth)
- **AI API**: 웹 Next.js API 라우트 경유 (Gemini 2.0-flash-exp)
- **결제**: RevenueCat (react-native-purchases)
- **모노레포**: Turborepo + pnpm, `packages/shared` 크로스 플랫폼 코드

---

## 3. Assumptions

- A1: 웹 API 엔드포인트 (`/api/ai-tip`, `/api/analyze`)가 안정적으로 동작한다
- A2: `EXPO_PUBLIC_WEB_API_URL` 환경 변수로 웹 API 접근이 가능하다
- A3: RevenueCat 대시보드에 앱과 상품이 사전 설정된다
- A4: Apple App Store / Google Play Console에 인앱 구매 상품이 등록된다
- A5: Supabase Storage에 오디오 파일 업로드 정책이 설정된다
- A6: SPEC-MOBILE-005의 학습 플로우 UI가 완료 또는 병행 가능하다
- A7: `users.plan` 컬럼이 RevenueCat 구독 상태와 동기화 가능하다

---

## 4. Requirements

### 4.1 AI Features

#### R-AI-001: AI 팁 생성 (Event-Driven)
**WHEN** 사용자가 ScriptLine에서 난이도 태그를 선택하고 AI 팁 생성 버튼을 탭하면, **THEN** 시스템은 웹 API `/api/ai-tip` 엔드포인트를 호출하여 한국어 학습 팁을 생성하고 화면에 표시해야 한다.

#### R-AI-002: AI 분석 (Event-Driven)
**WHEN** 사용자가 문장에 대한 피드백 유형을 선택하고 분석을 요청하면, **THEN** 시스템은 웹 API `/api/analyze` 엔드포인트를 호출하여 `{analysis, tips, focusPoint}` 응답을 받아 표시해야 한다.

#### R-AI-003: AI 노트 저장 (Event-Driven)
**WHEN** AI 팁 또는 분석 결과가 생성되면, **THEN** 시스템은 `AINote` 형식으로 appStore와 Supabase `ai_notes` 테이블에 저장해야 한다.

#### R-AI-004: 난이도 태그 선택 UI (Ubiquitous)
시스템은 **항상** 연음, 문법, 발음, 속도 태그를 선택 가능한 UI로 제공해야 한다.

#### R-AI-005: AI 팁 표시 (State-Driven)
**IF** AI 노트가 해당 문장에 대해 존재하면, **THEN** ScriptLine에서 저장된 AI 팁을 즉시 표시해야 한다.

#### R-AI-006: 녹음 업로드 (Event-Driven)
**WHEN** 사용자가 쉐도잉 녹음을 완료하면, **THEN** 시스템은 녹음 파일을 Supabase Storage에 업로드하고 메타데이터를 저장해야 한다.

#### R-AI-007: AI 발음 피드백 (Event-Driven)
**WHEN** 녹음 파일이 업로드되면, **THEN** 시스템은 기본 발음 점수(유사도 스코어링)를 제공해야 한다.

#### R-AI-008: AI 기능 플랜 제한 (State-Driven)
**IF** 사용자 플랜이 FREE이면, **THEN** AI 팁 생성 및 분석 기능 접근을 차단하고 업그레이드 안내를 표시해야 한다.

#### R-AI-009: 로딩 상태 표시 (State-Driven)
**IF** AI API 호출이 진행 중이면, **THEN** 로딩 인디케이터를 표시하고 중복 요청을 방지해야 한다.

#### R-AI-010: AI API 오류 처리 (Unwanted)
시스템은 AI API 호출 실패 시 앱이 크래시**하지 않아야 하며**, 사용자에게 재시도 옵션과 함께 오류 메시지를 표시해야 한다.

### 4.2 RevenueCat Payments

#### R-PAY-001: RevenueCat SDK 초기화 (Ubiquitous)
시스템은 **항상** 앱 시작 시 RevenueCat SDK를 초기화하고 사용자 식별을 완료해야 한다.

#### R-PAY-002: 페이월 화면 (Event-Driven)
**WHEN** 사용자가 유료 기능에 접근하거나 프로필에서 업그레이드를 탭하면, **THEN** 시스템은 플랜 비교 및 구매 UI가 포함된 페이월 화면을 표시해야 한다.

#### R-PAY-003: 구매 처리 (Event-Driven)
**WHEN** 사용자가 플랜을 선택하고 구매를 확인하면, **THEN** 시스템은 RevenueCat를 통해 Apple/Google 구매를 처리하고 결과를 표시해야 한다.

#### R-PAY-004: 플랜 동기화 (Event-Driven)
**WHEN** 구매가 성공적으로 완료되면, **THEN** 시스템은 Supabase `users.plan` 컬럼을 해당 플랜으로 업데이트해야 한다.

#### R-PAY-005: 구독 상태 확인 (Ubiquitous)
시스템은 **항상** `useSubscription()` hook을 통해 현재 구독 상태를 앱 전체에서 접근 가능하게 해야 한다.

#### R-PAY-006: 구매 복원 (Event-Driven)
**WHEN** 사용자가 구매 복원을 요청하면, **THEN** 시스템은 RevenueCat를 통해 이전 구매를 복원하고 플랜을 동기화해야 한다.

#### R-PAY-007: 구독 만료 처리 (Event-Driven)
**WHEN** 구독이 만료되면, **THEN** 시스템은 `users.plan`을 FREE로 업데이트하고 유료 기능 접근을 차단해야 한다.

#### R-PAY-008: 영수증 검증 (Ubiquitous)
시스템은 **항상** RevenueCat 서버를 통해 영수증 검증을 수행하고, 클라이언트 측 검증에만 의존**하지 않아야 한다**.

#### R-PAY-009: 결제 오류 처리 (Unwanted)
시스템은 결제 실패 시 사용자 데이터를 손상시키**지 않아야 하며**, 명확한 오류 메시지와 재시도 옵션을 제공해야 한다.

---

## 5. Scope

### 5.1 In Scope
- 모바일 AI 팁 생성 UI (난이도 태그 선택 + 생성 버튼)
- 웹 API 엔드포인트 호출 (`/api/ai-tip`, `/api/analyze`)
- AI 팁/분석 결과 표시 (study/listening/shadowing 화면)
- AI 노트 영속화 (appStore CRUD, 기존 구현 활용)
- Supabase Storage 녹음 파일 업로드
- 기본 AI 발음 피드백 (유사도 스코어링)
- RevenueCat SDK 통합 (react-native-purchases)
- 페이월 UI (플랜 비교, 구매 플로우)
- 플랜 티어별 기능 게이팅
- Supabase `users.plan` 동기화
- 구매 복원 플로우
- RevenueCat 서버 영수증 검증

### 5.2 Out of Scope
- 오프라인 AI 기능 (SPEC-MOBILE-007)
- 고급 AI 음성 분석 (향후 SPEC)
- 어드민 결제 관리 (웹 어드민)
- RevenueCat 웹훅 서버 구현 (별도 백엔드 SPEC)

---

## 6. Technical Design

### 6.1 AI API 클라이언트
```
모바일 앱 -> EXPO_PUBLIC_WEB_API_URL/api/ai-tip -> Next.js API Route -> Gemini API
모바일 앱 -> EXPO_PUBLIC_WEB_API_URL/api/analyze -> Next.js API Route -> Gemini API
```
- `ai-api.ts`: fetch 기반 API 클라이언트, 인증 토큰 포함
- 에러 핸들링: 타임아웃, 네트워크 오류, API 오류 분류
- 로딩 상태 관리: 중복 요청 방지

### 6.2 녹음 업로드
- Supabase Storage `recordings` 버킷에 업로드
- 파일 경로: `{userId}/{videoId}/{sentenceId}/{timestamp}.m4a`
- 메타데이터: sentenceId, videoId, duration, fileSize

### 6.3 RevenueCat 통합
- `revenue-cat.ts`: SDK 초기화, 사용자 식별 (Supabase Auth UID)
- Offerings 조회 -> 페이월 UI 표시
- 구매 완료 -> customerInfo에서 entitlements 확인 -> `users.plan` 업데이트
- 앱 시작 시 customerInfo 확인으로 플랜 동기화

### 6.4 기능 게이팅
```typescript
// useSubscription hook
const { plan, canUseAI, isLoading } = useSubscription();
// plan: 'FREE' | 'STANDARD' | 'MASTER'
// canUseAI: plan !== 'FREE'
```

### 6.5 파일 구조
```
apps/mobile/
  app/
    paywall.tsx                    [NEW]
  src/
    components/ai/                [NEW]
      AiTipButton.tsx
      AiTipCard.tsx
      DifficultyTagSelector.tsx
    components/paywall/           [NEW]
      PlanCard.tsx
      PurchaseButton.tsx
    lib/
      ai-api.ts                   [NEW]
      revenue-cat.ts              [NEW]
    hooks/
      useSubscription.ts          [NEW]
```

---

## 7. Traceability

| 요구사항 ID | 카테고리 | 관련 컴포넌트 |
|------------|---------|--------------|
| R-AI-001 | AI | AiTipButton, ai-api.ts |
| R-AI-002 | AI | ai-api.ts, AiTipCard |
| R-AI-003 | AI | appStore, supabase-store |
| R-AI-004 | AI | DifficultyTagSelector |
| R-AI-005 | AI | ScriptLine, AiTipCard |
| R-AI-006 | AI | useAudioRecorder, Supabase Storage |
| R-AI-007 | AI | ai-api.ts |
| R-AI-008 | AI/PAY | useSubscription |
| R-AI-009 | AI | AiTipButton |
| R-AI-010 | AI | ai-api.ts |
| R-PAY-001 | PAY | revenue-cat.ts |
| R-PAY-002 | PAY | paywall.tsx, PlanCard |
| R-PAY-003 | PAY | PurchaseButton, revenue-cat.ts |
| R-PAY-004 | PAY | revenue-cat.ts, Supabase |
| R-PAY-005 | PAY | useSubscription |
| R-PAY-006 | PAY | revenue-cat.ts |
| R-PAY-007 | PAY | revenue-cat.ts, useSubscription |
| R-PAY-008 | PAY | RevenueCat Server |
| R-PAY-009 | PAY | PurchaseButton |
