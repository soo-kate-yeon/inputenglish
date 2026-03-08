# Release Checklist

항목 중 시뮬레이터로 검증 불가한 것들을 별도 표기.

## 푸시 알림 (실기기 필수)

- [ ] 앱 최초 실행 시 알림 권한 요청 다이얼로그 표시 (AC-PUSH-001)
- [ ] 로그인 후 Supabase `push_tokens` 테이블에 토큰 저장 확인 (AC-PUSH-002)
  - Supabase Dashboard > Table Editor > push_tokens 에서 행 존재 여부 확인
  - `push_tokens` 테이블 및 RLS 정책 사전 생성 필요 (docs/supabase-setup.md 참고)
- [ ] 포그라운드 상태에서 알림 수신 시 인앱 배너 표시 (AC-PUSH-005)
- [ ] 백그라운드/종료 상태에서 알림 탭 시 딥링킹 동작 (AC-PUSH-005)
- [ ] 알림 설정 UI 토글 변경 후 MMKV 저장 유지 확인 (앱 재시작 후 설정 유지)

## 오프라인 지원 (릴리즈 빌드 권장)

> 개발 빌드에서 네트워크 조작이 제한적이므로 릴리즈 빌드 또는 프리뷰 빌드에서 테스트

- [ ] 네트워크 차단 시 오프라인 배너 표시 (AC-OFF-001)
- [ ] 네트워크 복구 시 배너 자동 제거 (AC-OFF-001)
- [ ] 오프라인 상태에서 쓰기 작업 MMKV 큐 저장 (AC-OFF-002)
- [ ] 앱 재시작 후 오프라인 큐 유지 (AC-OFF-002)
- [ ] 네트워크 복구 시 큐 자동 동기화 (AC-OFF-003)
- [ ] 동기화 실패 시 재시도 (최대 3회) (AC-OFF-003)
- [ ] 캐싱된 자막 오프라인 조회 (AC-OFF-004)
- [ ] 비디오 재생 화면에서 오프라인 UI 표시 (AC-OFF-007)

## 릴리즈 설정

- [ ] `eas.json` — development / preview / production 프로필 모두 정의 (AC-REL-001)
- [ ] `eas.json` — production 프로필 `autoIncrement: true` 설정 (AC-REL-001)
- [ ] `app.json` — version / ios.buildNumber / android.versionCode 일관성 확인 (AC-REL-005)
- [ ] iOS 아이콘 1024×1024, Android adaptive icon, 스플래시 스크린 에셋 존재 (AC-REL-006)
- [ ] iOS `.entitlements` 파일에 `aps-environment` 키 포함 (AC-PUSH-003)
- [ ] App Store 메타데이터 (한국어/영어 설명, 키워드, 카테고리, 개인정보 처리방침 URL) (AC-REL-002)
- [ ] Play Store 메타데이터 (한국어/영어 설명, 콘텐츠 등급, 개인정보 처리방침 URL) (AC-REL-003)

## CI/CD

- [ ] `main` 브랜치에 `v*` 태그 푸시 시 GitHub Actions EAS Build 트리거 확인 (AC-REL-004)
- [ ] iOS / Android production 프로필 빌드 성공 확인

## Supabase 사전 설정

`push_tokens` 테이블 생성 (미생성 시 토큰 저장 실패):

```sql
create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  token text not null,
  platform text not null,
  created_at timestamptz default now(),
  unique(user_id, token)
);

alter table push_tokens enable row level security;
create policy "Users can manage own tokens" on push_tokens
  for all using (auth.uid() = user_id);
```
