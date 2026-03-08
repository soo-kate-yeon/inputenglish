# SPEC-MOBILE-007 Research Document

## 1. 현재 데이터 영속성 분석

### MMKV 어댑터
- 위치: `apps/mobile/src/lib/mmkv.ts`
- Zustand `StateStorage` 인터페이스 구현
- `studyStore`가 MMKV를 통해 영속화됨

### appStore 상태 관리
- Supabase와 optimistic update 패턴 사용
- `pendingSentenceOps` 필드로 미동기화 작업 추적
- `syncPendingOps(userId)` 메서드 존재하나 `loadUserData()` 호출 시에만 실행
- 공유 팩토리 패턴: `createAppStore(supabaseClient, getCurrentUserId)`

### 핵심 문제점
- 네트워크 상태 변화 시 자동 동기화 없음
- `syncPendingOps`가 앱 시작 시에만 호출됨
- 오프라인 상태에서 쓰기 작업 실패 시 복구 메커니즘 부재

---

## 2. 네트워크/API 현황

- Supabase 직접 쿼리 사용, 오프라인 핸들링 없음
- `@react-native-community/netinfo` 의존성 없음
- 네트워크 상태 모니터링 없음
- 백그라운드 동기화 메커니즘 없음
- `AppState` 리스너는 auth 토큰 refresh pause/resume만 처리

---

## 3. 푸시 알림 현황: 미구현

- `expo-notifications` 미설치
- iOS `.entitlements` 파일 비어 있음 (push capability 없음)
- Android manifest에 알림 권한 없음
- 푸시 토큰 수집/서버 동기화 로직 없음

---

## 4. 릴리스/빌드 현황

- `app.json`: version 1.0.0, bundle ID `kr.shadowoo.app`
- iOS/Android 네이티브 빌드: `expo prebuild`로 생성
- `eas.json` 설정 없음
- CI/CD: 웹 배포(Vercel)만 존재, 모바일 빌드 파이프라인 없음
- iOS deployment target: 15.1, New Architecture 활성화

---

## 5. 캐싱 참조 (웹)

- 웹에 `TranscriptCache` 존재: `sessionStorage` 사용, 24시간 TTL
- Cache-first 전략 + API fallback
- 모바일 MMKV로 적용 가능

---

## 6. 비디오/자막 데이터

- `fetchCuratedVideos()`로 Supabase에서 비디오 로드
- 모바일에서 자막 캐싱 없음
- YouTube iframe은 재생 시 네트워크 필수

---

## 7. 의존성 관계

| SPEC | 상태 | 관계 |
|------|------|------|
| SPEC-MOBILE-005 | 진행 중 | Study Flow + Archive + Profile (선행 의존) |
| SPEC-MOBILE-006 | 계획됨 | AI Features + RevenueCat (병렬 진행 가능) |
| SPEC-MOBILE-007 | 계획됨 | 본 SPEC (SPEC-005 완료 후 진행) |

---

## 8. 파일 구조 제안

```
apps/mobile/
  app/
    notifications.tsx              [NEW] 알림 설정 화면
  src/
    lib/
      offline-queue.ts             [NEW] 영속 오프라인 큐 관리자
      network-monitor.ts           [NEW] 네트워크 상태 감지
      transcript-cache.ts          [NEW] MMKV 기반 자막 캐시
      push-notifications.ts        [NEW] 푸시 알림 설정
    hooks/
      useNetworkStatus.ts          [NEW] 네트워크 상태 훅
      useOfflineSync.ts            [NEW] 오프라인 동기화 훅
    components/profile/
      NotificationPreferences.tsx  [NEW] 알림 설정 UI
  eas.json                         [NEW] EAS Build 설정
.github/workflows/
  deploy-mobile.yml                [NEW] 모바일 빌드 CI/CD
```

---

## 9. 기술 스택 참조

| 기술 | 버전 | 용도 |
|------|------|------|
| Expo SDK | 52+ | 모바일 프레임워크 |
| React Native | 0.76.3 | 네이티브 런타임 |
| TypeScript | 5.7 | 타입 안전성 |
| Zustand | 5 | 상태 관리 |
| Supabase | - | 백엔드/데이터베이스 |
| MMKV | - | 로컬 스토리지 |
| expo-notifications | 최신 안정 | 푸시 알림 (신규 설치) |
| @react-native-community/netinfo | 최신 안정 | 네트워크 감지 (신규 설치) |
| eas-cli | 최신 안정 | EAS Build (신규 설치) |

---

## 10. YouTube ToS 제약

- 오프라인 비디오 다운로드 불가 (YouTube 이용약관 위반)
- 자막 데이터와 메타데이터만 오프라인 캐싱 가능
- 비디오 재생은 항상 네트워크 연결 필요
