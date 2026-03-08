# SPEC-MOBILE-006 Research Document

## 1. AI Features - 웹 레퍼런스 분석

### 기존 웹 API 엔드포인트

**`/api/ai-tip` 엔드포인트:**
- Gemini 2.0-flash-exp 모델 사용
- 입력: sentence text + difficulty tags (연음, 문법, 발음, 속도)
- 출력: 한국어 학습 팁

**`/api/analyze` 엔드포인트:**
- 입력: sentence + feedback types
- 출력: JSON `{analysis, tips, focusPoint}`

### 기존 웹 UI 패턴 (SentenceItem.tsx)
- 난이도 태그 선택 UI -> API 호출 -> 팁 표시 흐름
- 사용자가 태그를 선택한 후 AI 팁 생성 버튼 클릭

### 공유 타입 및 데이터
- `AINote` 타입: `{id, videoId, sentenceId, sentenceText, userFeedback[], aiResponse: {analysis, tips, focusPoint}, createdAt}`
- `ai_notes` 테이블: Supabase에 존재, RLS 정책 적용됨
- `appStore`에 `aiNotes` 필드 존재
- `supabase-store.ts`에 `ai_notes` CRUD 작업 구현됨

### 녹음 -> AI 파이프라인 현황
- `useAudioRecorder` hook: expo-av 사용, M4A/AAC 포맷 로컬 파일 URI 저장
- `recordedSentences` map: `sentenceId -> audioUri` (메모리 내, 서버 미업로드)
- 서버 업로드 또는 녹음 AI 분석 기능 미구현 상태

---

## 2. 결제/구독 시스템 분석

### 현재 데이터 구조
- `users` 테이블 `plan` 컬럼: `CHECK (plan IN ('FREE', 'STANDARD', 'MASTER'))`, 기본값 `'FREE'`
- RevenueCat SDK 또는 결제 관련 코드 전무 - 그린필드 구현 필요

### 플랜 구조
| 플랜 | 설명 |
|------|------|
| FREE | 기본 무료 기능 |
| STANDARD | 중간 티어 |
| MASTER | 프리미엄 전체 기능 |

---

## 3. 모바일 API 패턴

- 모바일: `apps/mobile/src/lib/api.ts`를 통한 직접 Supabase 쿼리
- 웹: Next.js API 라우트로 서버 사이드 작업 처리 (Gemini API 키 등 비밀 키 필요)
- 모바일에서 Gemini 직접 호출 불가 (API 키 보안 문제)
- 모바일 -> 웹 API 엔드포인트 호출 방식 필요

---

## 4. 기술 스택 참조

| 기술 | 버전 |
|------|------|
| Expo SDK | 52+ |
| React Native | 0.76.3 |
| TypeScript | 5.7 |
| Zustand | 5 |
| Supabase | @supabase/supabase-js |
| expo-av | 녹음/재생 |

---

## 5. 의존성 관계

- **SPEC-MOBILE-004** (완료): 오디오 녹음 + 쉐도잉 화면
- **SPEC-MOBILE-005** (진행 중): 학습 플로우 + 아카이브 + 프로필 + 하이라이트
- **SPEC-MOBILE-007** (병렬): 오프라인 기능 (본 SPEC과 병렬 진행)

---

## 6. 제안 파일 구조

```
apps/mobile/
  app/
    paywall.tsx                    [NEW] 페이월 화면
  src/
    components/ai/                [NEW]
      AiTipButton.tsx              AI 팁 생성 트리거
      AiTipCard.tsx                AI 팁 표시 카드
      DifficultyTagSelector.tsx    태그 선택 UI
    components/paywall/           [NEW]
      PlanCard.tsx                 플랜 비교 카드
      PurchaseButton.tsx           구매 액션 버튼
    lib/
      ai-api.ts                   [NEW] AI API 클라이언트 (웹 엔드포인트 호출)
      revenue-cat.ts              [NEW] RevenueCat 설정
    hooks/
      useSubscription.ts          [NEW] 구독 상태 hook
```

---

## 7. 핵심 설계 결정사항

1. **AI API 호출 경로**: 모바일 -> 웹 Next.js API 라우트 -> Gemini (API 키 보안)
2. **웹 API Base URL**: `EXPO_PUBLIC_WEB_API_URL` 환경 변수로 설정
3. **구독 관리**: RevenueCat가 Apple/Google 구독 관리, Supabase `users.plan`과 동기화
4. **기능 게이팅**: `useSubscription()` hook이 플랜 티어 확인 후 AI 기능 허용
5. **녹음 업로드**: Supabase Storage에 업로드 (향후 AI 발음 분석용)
