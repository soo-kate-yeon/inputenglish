# SPEC-MOBILE-007: Acceptance Criteria

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

### AC-PUSH-001: expo-notifications 설정

**Scenario: 알림 권한 요청**
```gherkin
Given 사용자가 앱을 최초 실행할 때
When 알림 권한이 미설정이면
Then 알림 권한 요청 다이얼로그를 표시하고
And 사용자의 선택(허용/거부)을 저장한다
```

### AC-PUSH-002: 푸시 토큰 동기화

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

### AC-PUSH-003: iOS 푸시 설정

**Scenario: iOS entitlements 설정**
```gherkin
Given iOS 빌드를 수행할 때
When .entitlements 파일을 확인하면
Then aps-environment 키가 포함되어 있다
```

### AC-PUSH-004: 알림 카테고리

**Scenario: 학습 리마인더 알림**
```gherkin
Given 사용자가 학습 리마인더 알림을 활성화했을 때
When 설정된 시간이 되면
Then "오늘의 영어 학습을 시작해보세요!" 알림이 발송된다
```

### AC-PUSH-005: 인앱 알림 처리 및 딥링킹

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

### AC-PUSH-006: 알림 설정 UI

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

### AC-REL-002: App Store 메타데이터

**Scenario: iOS 메타데이터 준비**
```gherkin
Given App Store 제출을 준비할 때
When 메타데이터를 확인하면
Then 앱 설명(한국어, 영어), 키워드, 카테고리, 개인정보 처리방침 URL이 존재한다
```

### AC-REL-003: Play Store 메타데이터

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

### AC-REL-005: 버전 관리 전략

**Scenario: 버전 일관성 검증**
```gherkin
Given app.json을 확인할 때
When version, ios.buildNumber, android.versionCode를 검증하면
Then 세 값이 일관된 규칙에 따라 설정되어 있다
```

### AC-REL-006: 앱 아이콘/스플래시 스크린

**Scenario: 에셋 완성도 검증**
```gherkin
Given 빌드를 수행할 때
When 에셋을 확인하면
Then iOS용 아이콘(1024x1024), Android용 adaptive icon, 스플래시 스크린 이미지가 존재한다
```

---

## Quality Gate

| 항목 | 기준 |
|------|------|
| EARS 요구사항 | 모든 REQ에 대응하는 AC 존재 |
| 테스트 커버리지 | 신규 코드 85% 이상 |
| LSP 오류 | 0건 |
| TypeScript 타입 오류 | 0건 |
| 린트 오류 | 0건 |

## Definition of Done

- [ ] 모든 AC 시나리오가 테스트로 구현됨
- [ ] 오프라인 큐가 MMKV에 영속화되고 재연결 시 자동 동기화됨
- [ ] expo-notifications 설정 완료 및 푸시 토큰 Supabase 동기화
- [ ] eas.json 설정 완료 및 EAS Build 성공
- [ ] CI/CD 워크플로우 작동 확인
- [ ] 코드 리뷰 완료
- [ ] TypeScript 타입 오류 0건
