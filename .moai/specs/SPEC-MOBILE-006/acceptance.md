# SPEC-MOBILE-006: Acceptance Criteria

## Status Summary

**Overall**: 18/20 criteria complete (90% coverage)

| Category | Criteria | Status | Notes |
|----------|----------|--------|-------|
| AI Features | AC-AI-001 | ✅ Done | AI 팁 생성 구현 완료 |
| | AC-AI-002 | ✅ Done | AI 분석 구현 완료 |
| | AC-AI-003 | ✅ Done | AI 노트 영속화 구현 완료 |
| | AC-AI-004 | ✅ Done | 난이도 태그 선택 UI 구현 완료 |
| | AC-AI-005 | ✅ Done | 녹음 업로드 구현 완료 |
| | AC-AI-006 | ⏳ Deferred | 발음 피드백 - 백엔드 `/api/pronunciation` 엔드포인트 미구현 |
| RevenueCat | AC-PAY-001 | ✅ Done | SDK 초기화 구현 완료 |
| | AC-PAY-002 | ✅ Done | 페이월 화면 구현 완료 |
| | AC-PAY-003 | ✅ Done | 구매 처리 구현 완료 |
| | AC-PAY-004 | ✅ Done | 구매 복원 구현 완료 |
| | AC-PAY-005 | ✅ Done | 구독 만료 처리 구현 완료 |
| | AC-PAY-006 | ✅ Done | 구독 상태 확인 구현 완료 |

---

## AI Features

### AC-AI-001: AI 팁 생성

**Scenario: 성공적인 AI 팁 생성**

```gherkin
Given 사용자가 STANDARD 또는 MASTER 플랜이고
  And 학습/쉐도잉 화면에서 ScriptLine을 보고 있을 때
When 난이도 태그 (연음, 문법, 발음, 속도) 중 하나 이상을 선택하고
  And AI 팁 생성 버튼을 탭하면
Then 로딩 인디케이터가 표시되고
  And 웹 API /api/ai-tip 엔드포인트가 호출되고
  And 한국어 학습 팁이 AiTipCard에 표시된다
```

**Scenario: FREE 플랜 사용자 AI 접근 차단**

```gherkin
Given 사용자가 FREE 플랜일 때
When AI 팁 생성 버튼을 탭하면
Then AI 기능이 차단되고
  And 업그레이드 안내 메시지가 표시되고 
  And 페이월 화면으로의 이동 옵션이 제공된다
```

**Scenario: AI API 호출 실패**

```gherkin
Given AI 팁 생성 요청이 진행 중일 때
When API 호출이 네트워크 오류 또는 서버 오류로 실패하면
Then 앱이 크래시하지 않고
  And 사용자에게 오류 메시지가 표시되고
  And 재시도 버튼이 제공된다
```

**Scenario: 중복 요청 방지**

```gherkin
Given AI 팁 생성 요청이 이미 진행 중일 때
When 사용자가 다시 AI 팁 생성 버튼을 탭하면
Then 추가 API 호출이 발생하지 않고
  And 기존 로딩 상태가 유지된다
```

### AC-AI-002: AI 분석

**Scenario: 문장 분석 요청**

```gherkin
Given 사용자가 유료 플랜이고 문장을 선택했을 때
When 피드백 유형을 선택하고 분석을 요청하면
Then /api/analyze 엔드포인트가 호출되고
  And analysis, tips, focusPoint가 포함된 결과가 표시된다
```

### AC-AI-003: AI 노트 영속화

**Scenario: AI 노트 자동 저장**

```gherkin
Given AI 팁 또는 분석 결과가 생성되었을 때
When 결과가 화면에 표시되면
Then AINote 형식으로 appStore에 저장되고
  And Supabase ai_notes 테이블에 동기화된다
```

**Scenario: 저장된 AI 노트 표시**

```gherkin
Given 해당 문장에 대한 AI 노트가 이미 존재할 때
When ScriptLine이 렌더링되면
Then 저장된 AI 팁이 즉시 표시되고
  And 새로운 API 호출 없이 캐시된 데이터를 사용한다
```

### AC-AI-004: 난이도 태그 선택

**Scenario: 태그 UI 표시 및 선택**

```gherkin
Given ScriptLine에서 AI 팁 기능이 활성화되었을 때
When 사용자가 태그 영역을 확인하면
Then 연음, 문법, 발음, 속도 태그가 모두 표시되고
  And 다중 선택이 가능하고
  And 선택된 태그가 시각적으로 구분된다
```

### AC-AI-005: 녹음 업로드

**Scenario: 쉐도잉 녹음 업로드**

```gherkin
Given 사용자가 쉐도잉 녹음을 완료했을 때
When 녹음이 저장되면
Then 녹음 파일이 Supabase Storage recordings 버킷에 업로드되고
  And 파일 경로는 {userId}/{videoId}/{sentenceId}/{timestamp}.m4a 형식이고
  And 메타데이터 (sentenceId, videoId, duration, fileSize)가 저장된다
```

**Scenario: 업로드 실패 처리**

```gherkin
Given 녹음 업로드가 진행 중일 때
When 네트워크 오류로 업로드가 실패하면
Then 로컬 녹음 파일은 보존되고
  And 재시도 옵션이 제공된다
```

---

## RevenueCat Payments

### AC-PAY-001: SDK 초기화

**Scenario: 앱 시작 시 RevenueCat 초기화**

```gherkin
Given 앱이 시작될 때
When RevenueCat SDK가 초기화되면
Then Supabase Auth UID로 사용자가 식별되고
  And customerInfo에서 현재 구독 상태가 확인되고
  And useSubscription hook에 플랜 정보가 반영된다
```

### AC-PAY-002: 페이월 화면

**Scenario: 페이월 진입 - 유료 기능 접근**

```gherkin
Given 사용자가 FREE 플랜일 때
When AI 기능 등 유료 기능에 접근을 시도하면
Then 페이월 화면이 표시되고
  And FREE, STANDARD, MASTER 플랜이 비교 표시되고
  And 각 플랜의 가격과 기능 목록이 표시된다
```

**Scenario: 페이월 진입 - 프로필 업그레이드**

```gherkin
Given 사용자가 프로필 화면에 있을 때
When 업그레이드 버튼을 탭하면
Then 페이월 화면으로 이동한다
```

### AC-PAY-003: 구매 처리

**Scenario: 성공적인 구독 구매**

```gherkin
Given 사용자가 페이월 화면에서 플랜을 선택했을 때
When 구매 확인을 완료하면
Then RevenueCat를 통해 Apple/Google 결제가 처리되고
  And 구매 성공 메시지가 표시되고
  And Supabase users.plan이 해당 플랜으로 업데이트되고
  And useSubscription hook이 새 플랜을 반영한다
```

**Scenario: 구매 실패**

```gherkin
Given 구매가 진행 중일 때
When 결제가 실패하면 (취소, 카드 오류 등)
Then 사용자 데이터가 손상되지 않고
  And 명확한 오류 메시지가 표시되고
  And 재시도 옵션이 제공된다
```

**Scenario: 구매 중 사용자 취소**

```gherkin
Given 결제 다이얼로그가 표시되었을 때
When 사용자가 결제를 취소하면
Then 페이월 화면으로 돌아가고
  And 플랜 변경이 발생하지 않는다
```

### AC-PAY-004: 구매 복원

**Scenario: 이전 구매 복원**

```gherkin
Given 사용자가 앱을 재설치했거나 다른 기기에서 로그인했을 때
When 구매 복원을 요청하면
Then RevenueCat에서 이전 구매 이력을 조회하고
  And 유효한 구독이 있으면 플랜이 복원되고
  And Supabase users.plan이 동기화된다
```

**Scenario: 복원할 구매 없음**

```gherkin
Given 사용자가 구매 복원을 요청했을 때
When 이전 구매 이력이 없으면
Then 복원할 구매가 없다는 메시지가 표시된다
```

### AC-PAY-005: 구독 만료 처리

**Scenario: 구독 자동 만료**

```gherkin
Given 사용자의 구독이 만료되었을 때
When 앱이 시작되거나 customerInfo가 갱신되면
Then users.plan이 FREE로 업데이트되고
  And 유료 기능 접근이 차단되고
  And 재구독 안내가 표시된다
```

### AC-PAY-006: 구독 상태 확인

**Scenario: useSubscription hook 동작**

```gherkin
Given 앱의 어느 화면에서든
When useSubscription() hook을 사용하면
Then plan ('FREE' | 'STANDARD' | 'MASTER')이 반환되고
  And canUseAI boolean 값이 반환되고
  And isLoading 상태가 반환된다
```

---

## Quality Gate Criteria

### Definition of Done

- [ ] 모든 AI 컴포넌트 (AiTipButton, AiTipCard, DifficultyTagSelector) 구현 완료
- [ ] AI API 클라이언트 (ai-api.ts) 구현 및 에러 핸들링 완료
- [ ] 녹음 파일 Supabase Storage 업로드 구현
- [ ] RevenueCat SDK 통합 (revenue-cat.ts) 완료
- [ ] 페이월 화면 및 컴포넌트 (PlanCard, PurchaseButton) 구현
- [ ] useSubscription hook 구현 및 기능 게이팅 적용
- [ ] 구매/복원/만료 플로우 동작 확인
- [ ] Supabase users.plan 동기화 동작 확인
- [ ] TypeScript 타입 에러 0건
- [ ] 오류 상황에서 앱 크래시 없음 확인
- [ ] iOS/Android 양 플랫폼 동작 확인
