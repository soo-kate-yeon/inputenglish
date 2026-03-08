# SPEC-MOBILE-007: Acceptance Criteria

## 상태 개요 (Status Summary)

| 카테고리 | 상태 | 완료 항목 | Deferred 항목 | Not Started |
|---------|------|---------|--------------|------------|
| 오프라인 지원 (Offline) | Not Started | - | - | AC-OFF-001~008 |
| 푸시 알림 (Push) | Partially Completed | AC-PUSH-001, 002, 003, 005, 006 | AC-PUSH-004 | - |
| 릴리스 준비 (Release) | Partially Completed | AC-REL-005 | AC-REL-002, 003, 006 | AC-REL-001, 004 |

---

## 오프라인 지원

### AC-OFF-001: 네트워크 상태 감지

**Scenario: 네트워크 연결 끊김 감지**
```gherkin
Given 사용자가 앱을 사용 중이고 네트워크가 연결된 상태일 때
When 네트워크 연결이 끊기면
Then 앱은 3초 이내에 오프라인 상태를 감지하고
And 오프라인 배너/인디케이터를 화면에 표시한다
```

**Scenario: 네트워크 재연결 감지**
```gherkin
Given 앱이 오프라인 상태일 때
When 네트워크가 다시 연결되면
Then 앱은 3초 이내에 온라인 상태를 감지하고
And 오프라인 배너를 제거한다
```

### AC-OFF-002: 오프라인 큐 영속화

**Scenario: 오프라인 상태에서 쓰기 작업 큐잉**
```gherkin
Given 네트워크가 오프라인 상태일 때
When 사용자가 문장 완료, 북마크 추가 등 쓰기 작업을 수행하면
Then 해당 작업이 MMKV 오프라인 큐에 저장되고
And 사용자에게 "오프라인 저장됨" 피드백을 제공한다
```

**Scenario: 앱 재시작 후 큐 유지**
```gherkin
Given 오프라인 큐에 미동기화 작업 3건이 있을 때
When 앱을 완전히 종료하고 재시작하면
Then 오프라인 큐에 3건의 작업이 그대로 유지된다
```

### AC-OFF-003: 자동 재동기화

**Scenario: 네트워크 복구 시 자동 동기화**
```gherkin
Given 오프라인 큐에 미동기화 작업 5건이 있고 네트워크가 오프라인일 때
When 네트워크가 온라인으로 전환되면
Then 시스템은 큐의 작업을 FIFO 순서로 Supabase에 동기화하고
And 성공한 작업을 큐에서 제거하고
And 동기화 완료 시 사용자에게 알린다
```

**Scenario: 동기화 실패 시 재시도**
```gherkin
Given 동기화 중 특정 작업이 네트워크 오류로 실패할 때
When 재시도 횟수가 3회 미만이면
Then 해당 작업을 큐에 유지하고 다음 동기화 시 재시도한다
```

**Scenario: 동기화 최대 재시도 초과**
```gherkin
Given 특정 작업이 3회 재시도에 모두 실패했을 때
When 다음 동기화가 트리거되면
Then 해당 작업을 실패로 표시하고
And 사용자에게 수동 동기화 안내를 제공한다
```

### AC-OFF-004: 자막/메타데이터 캐싱

**Scenario: 자막 최초 조회 시 캐싱**
```gherkin
Given 사용자가 특정 비디오의 자막을 처음 조회할 때
When Supabase에서 자막 데이터를 성공적으로 가져오면
Then 해당 자막이 MMKV에 캐싱되고
And 캐시 TTL은 7일로 설정된다
```

**Scenario: 오프라인에서 캐싱된 자막 조회**
```gherkin
Given 비디오 A의 자막이 캐싱되어 있고 네트워크가 오프라인일 때
When 사용자가 비디오 A의 자막을 조회하면
Then 캐싱된 자막 데이터가 표시된다
```

### AC-OFF-005: Cache-First 읽기 패턴

**Scenario: 캐시 히트**
```gherkin
Given 비디오 메타데이터가 로컬 캐시에 존재할 때
When 해당 데이터를 조회하면
Then 네트워크 요청 없이 캐시된 데이터를 즉시 반환하고
And 백그라운드에서 데이터를 갱신한다 (stale-while-revalidate)
```

**Scenario: 캐시 미스**
```gherkin
Given 요청한 데이터가 로컬 캐시에 없을 때
When 해당 데이터를 조회하면
Then 네트워크 요청을 수행하고
And 응답 데이터를 캐시에 저장한 후 반환한다
```

### AC-OFF-006: 충돌 해결

**Scenario: Last-Write-Wins 충돌 해결**
```gherkin
Given 로컬 데이터(timestamp: T1)와 서버 데이터(timestamp: T2)가 충돌할 때
When T2 > T1이면 (서버가 더 최신)
Then 서버 데이터로 로컬 데이터를 덮어쓴다
```

```gherkin
Given 로컬 데이터(timestamp: T1)와 서버 데이터(timestamp: T2)가 충돌할 때
When T1 > T2이면 (로컬이 더 최신)
Then 로컬 데이터를 서버에 업로드한다
```

### AC-OFF-007: 오프라인 UI 표시

**Scenario: 오프라인 상태 UI**
```gherkin
Given 네트워크가 오프라인 상태일 때
When 사용자가 비디오 재생 화면에 진입하면
Then 비디오 재생 버튼이 비활성화되고
And "네트워크 연결이 필요합니다" 메시지가 표시된다
```

### AC-OFF-008: 비디오 다운로드 금지

**Scenario: 비디오 다운로드 시도 차단**
```gherkin
Given 앱의 어떤 화면에서든
When 시스템이 YouTube 비디오 파일을 로컬에 저장하려는 시도가 있으면
Then 해당 작업을 차단한다
```

---

## 푸시 알림

### AC-PUSH-001: expo-notifications 설정 [COMPLETED]

**구현 위치:** `apps/mobile/src/lib/push-notifications.ts`

**완료 사항:**
- `initPushNotifications()` 함수로 권한 요청 및 토큰 발급 분리
- iOS/Android 모두 expo-notifications 설정 완료
- 시뮬레이터에서 권한 다이얼로그 테스트 가능

**Scenario: 알림 권한 요청**
```gherkin
Given 사용자가 앱을 최초 실행할 때
When 알림 권한이 미설정이면
Then 알림 권한 요청 다이얼로그를 표시하고
And 사용자의 선택(허용/거부)을 저장한다
```

**상태:** ✅ COMPLETED

### AC-PUSH-002: 푸시 토큰 동기화 [COMPLETED]

**구현 위치:** `apps/mobile/src/lib/push-notifications.ts`, `apps/mobile/app/_layout.tsx`

**완료 사항:**
- `registerPushToken()` 함수로 Supabase push_tokens 테이블에 토큰 저장
- 로그인 시 자동으로 토큰 등록 (useEffect in _layout.tsx)
- user_id, token, platform 저장 및 갱신

**Scenario: 앱 시작 시 토큰 등록**
```gherkin
Given 사용자가 로그인된 상태로 앱을 시작할 때
When 푸시 토큰이 발급되면
Then Supabase push_tokens 테이블에 user_id, token, platform을 저장하고
And 기존 토큰이 있으면 갱신한다
```

**Scenario: 토큰 갱신**
```gherkin
Given 기존 푸시 토큰이 등록되어 있을 때
When 시스템에 의해 토큰이 변경되면
Then Supabase에 새 토큰으로 업데이트한다
```

**상태:** ✅ COMPLETED

### AC-PUSH-003: iOS 푸시 설정 [COMPLETED]

**구현 위치:** `apps/mobile/app.json`

**완료 사항:**
- `ios.entitlements.aps-environment: "production"` 설정
- Expo prebuild 시 자동으로 iOS .entitlements 파일에 포함

**Scenario: iOS entitlements 설정**
```gherkin
Given iOS 빌드를 수행할 때
When .entitlements 파일을 확인하면
Then aps-environment 키가 포함되어 있다
```

**상태:** ✅ COMPLETED

### AC-PUSH-004: 알림 카테고리 [DEFERRED - Server-side implementation]

**상태:** ⏳ DEFERRED

**사유:** 학습 리마인더 알림 발송은 서버 사이드 스케줄링 필요
- 클라이언트 알림 설정은 `useNotificationSettings.ts`와 `profile.tsx`에서 완료
- 서버에서 사용자의 알림 설정을 읽고 정해진 시간에 푸시 발송하는 로직은 별도 구현 필요
- Supabase Edge Functions 또는 별도 notification service에서 구현 예정

**필수 구현 사항:**
- Supabase push_tokens 테이블에서 알림을 원하는 사용자 조회
- 설정된 시간(예: 아침 8시)에 cronJob으로 푸시 발송
- 각 사용자의 시간대(timezone) 고려

**Scenario: 학습 리마인더 알림**
```gherkin
Given 사용자가 학습 리마인더 알림을 활성화했을 때
When 설정된 시간이 되면
Then "오늘의 영어 학습을 시작해보세요!" 알림이 발송된다
```

**현재 상태:** 클라이언트 설정만 완료, 서버 발송 로직 미구현

### AC-PUSH-005: 인앱 알림 처리 및 딥링킹 [COMPLETED]

**구현 위치:** `apps/mobile/src/lib/push-notifications.ts`, `apps/mobile/app/_layout.tsx`

**완료 사항:**
- `handleNotificationResponse()`: 알림 탭 시 딥링크로 해당 화면 이동
- notification 리스너 등록 (_layout.tsx에서)
- 포그라운드/백그라운드 알림 처리

**Scenario: 포그라운드 알림 수신**
```gherkin
Given 앱이 포그라운드에서 실행 중일 때
When 푸시 알림이 수신되면
Then 인앱 알림 배너가 표시되고
And 배너 탭 시 해당 화면으로 이동한다
```

**Scenario: 백그라운드 알림 탭**
```gherkin
Given 앱이 백그라운드이거나 종료된 상태일 때
When 사용자가 푸시 알림을 탭하면
Then 앱이 열리고 알림에 연결된 화면으로 딥링킹한다
```

**상태:** ✅ COMPLETED

### AC-PUSH-006: 알림 설정 UI [COMPLETED]

**구현 위치:** `apps/mobile/src/hooks/useNotificationSettings.ts`, `apps/mobile/app/(tabs)/profile.tsx`

**완료 사항:**
- `useNotificationSettings()` hook: MMKV 기반 알림 설정 관리
- Profile 탭에 알림 설정 섹션 추가
- 3가지 알림 카테고리 토글 (학습 리마인더, 새 콘텐츠, Streak)
- 로컬 저장 (MMKV) 및 나중에 서버 동기화 가능

**Scenario: 알림 설정 화면 접근**
```gherkin
Given 사용자가 프로필 탭에 있을 때
When 알림 설정 메뉴를 탭하면
Then 알림 카테고리별(학습 리마인더, 새 콘텐츠, Streak) 토글이 표시된다
```

**Scenario: 알림 카테고리 토글**
```gherkin
Given 알림 설정 화면에서
When 사용자가 "학습 리마인더" 토글을 OFF로 변경하면
Then 해당 설정이 로컬 및 서버에 저장되고
And 학습 리마인더 알림이 더 이상 수신되지 않는다
```

**상태:** ✅ COMPLETED (로컬 저장만, 서버 동기화는 추후)

---

## 릴리스 준비

### AC-REL-001: EAS Build 설정

**Scenario: eas.json 설정 검증**
```gherkin
Given eas.json 파일이 존재할 때
When 설정을 검증하면
Then development, preview, production 프로필이 모두 정의되어 있고
And production 프로필에 autoIncrement가 true로 설정되어 있다
```

### AC-REL-002: App Store 메타데이터 [DEFERRED - Non-code preparation]

**상태:** ⏳ DEFERRED

**사유:** 마케팅/PM 담당 비개발자 작업
- 앱 스토어 메타데이터는 코드가 아닌 마케팅 자료로 분류
- 개발팀 외부에서 준비하는 항목

**필수 준비 사항:**
- 앱 설명 (한국어, 영어)
- 키워드
- 카테고리
- 개인정보 처리방침 URL
- 스크린샷 및 프로모션 이미지

**Scenario: iOS 메타데이터 준비**
```gherkin
Given App Store 제출을 준비할 때
When 메타데이터를 확인하면
Then 앱 설명(한국어, 영어), 키워드, 카테고리, 개인정보 처리방침 URL이 존재한다
```

### AC-REL-003: Play Store 메타데이터 [DEFERRED - Non-code preparation]

**상태:** ⏳ DEFERRED

**사유:** 마케팅/PM 담당 비개발자 작업
- 플레이 스토어 메타데이터는 코드가 아닌 마케팅 자료로 분류
- 개발팀 외부에서 준비하는 항목

**필수 준비 사항:**
- 앱 설명 (한국어, 영어)
- 콘텐츠 등급
- 개인정보 처리방침 URL
- 스크린샷 및 프로모션 이미지

**Scenario: Android 메타데이터 준비**
```gherkin
Given Play Store 제출을 준비할 때
When 메타데이터를 확인하면
Then 앱 설명(한국어, 영어), 콘텐츠 등급 정보, 개인정보 처리방침 URL이 존재한다
```

### AC-REL-004: CI/CD 파이프라인

**Scenario: 태그 푸시 시 EAS Build 트리거**
```gherkin
Given main 브랜치에 v1.0.0 형식의 태그가 푸시될 때
When GitHub Actions 워크플로우가 실행되면
Then EAS Build가 iOS 및 Android production 프로필로 트리거되고
And 빌드 결과가 GitHub Actions 로그에 기록된다
```

### AC-REL-005: 버전 관리 전략 [COMPLETED]

**구현 위치:** `apps/mobile/app.json`

**완료 사항:**
- `version: "1.0.0"` (Semantic Versioning)
- `ios.buildNumber: "1"`
- `android.versionCode: 1`
- 일관된 버전 관리 규칙 설정

**Scenario: 버전 일관성 검증**
```gherkin
Given app.json을 확인할 때
When version, ios.buildNumber, android.versionCode를 검증하면
Then 세 값이 일관된 규칙에 따라 설정되어 있다
```

**상태:** ✅ COMPLETED

### AC-REL-006: 앱 아이콘/스플래시 스크린 [DEFERRED - Design assets]

**상태:** ⏳ DEFERRED

**사유:** 디자인 에셋 준비 미완료
- 디자인 팀에서 제공할 때까지 대기 중
- 에셋이 준비되면 `apps/mobile/assets/` 디렉토리에 추가 및 `app.json` 설정 필요

**필수 에셋:**
- iOS 앱 아이콘 (1024x1024 PNG)
- Android adaptive icon (여러 해상도)
- 스플래시 스크린 이미지 (1024x1024 또는 각 플랫폼별)

**Scenario: 에셋 완성도 검증**
```gherkin
Given 빌드를 수행할 때
When 에셋을 확인하면
Then iOS용 아이콘(1024x1024), Android용 adaptive icon, 스플래시 스크린 이미지가 존재한다
```

---

---

## 완료 요약 (Completion Summary)

### 구현 완료 항목 (5/22)
- ✅ AC-PUSH-001: expo-notifications 설정
- ✅ AC-PUSH-002: 푸시 토큰 동기화
- ✅ AC-PUSH-003: iOS 푸시 설정
- ✅ AC-PUSH-005: 인앱 알림 처리 및 딥링킹
- ✅ AC-PUSH-006: 알림 설정 UI
- ✅ AC-REL-005: 버전 관리 전략

### Deferred 항목 (4/22)
- ⏳ AC-PUSH-004: 알림 카테고리 (서버 사이드 스케줄링 필요)
- ⏳ AC-REL-002: App Store 메타데이터 (비개발자 작업)
- ⏳ AC-REL-003: Play Store 메타데이터 (비개발자 작업)
- ⏳ AC-REL-006: 앱 아이콘/스플래시 스크린 (디자인 에셋 대기)

### Not Started 항목 (8/22)
- AC-OFF-001~008: 오프라인 지원 전체 (추후 별도 구현)
- AC-REL-001: EAS Build 설정
- AC-REL-004: CI/CD 파이프라인

---

## Quality Gate

| 항목 | 기준 | 상태 |
|------|------|------|
| EARS 요구사항 | 모든 REQ에 대응하는 AC 존재 | ✅ 완료 |
| 테스트 커버리지 | 신규 코드 85% 이상 | 📋 적용 대기 |
| LSP 오류 | 0건 | ✅ 통과 |
| TypeScript 타입 오류 | 0건 | ✅ 통과 |
| 린트 오류 | 0건 | ✅ 통과 |

## Definition of Done

- [ ] 모든 AC 시나리오가 테스트로 구현됨
- [ ] 오프라인 큐가 MMKV에 영속화되고 재연결 시 자동 동기화됨
- [ ] expo-notifications 설정 완료 및 푸시 토큰 Supabase 동기화
- [ ] eas.json 설정 완료 및 EAS Build 성공
- [ ] CI/CD 워크플로우 작동 확인
- [ ] 코드 리뷰 완료
- [ ] TypeScript 타입 오류 0건
