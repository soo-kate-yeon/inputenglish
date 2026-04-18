## SPEC-MOBILE-013 Progress

- Started: 2026-04-18
- Completed: 2026-04-19
- Branch: codex/stacked-changes-20260405
- Final commit for home/expression polish: a2aa781

## Delivery Summary

- 홈을 `오늘의 인풋` 중심으로 재구성하고 기존 탐색형 목록은 `탐색` 탭으로 분리했다.
- daily queue를 learning profile 기반으로 생성하고, expression 모드에서는 transformation exercise가 실제로 연결된 key sentence만 노출되도록 보강했다.
- 카드 내부 구간 재생, 번역 토글, 반복 토글, 즉시 녹음 CTA를 홈 카드 안에서 바로 수행할 수 있게 정리했다.
- `goal_mode`에 따라 하단 follow-up surface가 달라지도록 분기했고, expression 모드는 inline practice carousel + sample answer reveal UX까지 연결했다.
- swipe affordance와 카드 전환 미세 상호작용을 정리해 이전/다음 카드 이동이 홈 안에서 이어지도록 맞췄다.

## Requirement Status

| Requirement Group | Status | Notes |
|---|---|---|
| Home information architecture | DONE | `index`는 오늘의 인풋 중심, `explore` 탭은 별도 유지 |
| Daily input card | DONE | 구간 재생, 번역 토글, 녹음 CTA, 원본 영상 링크 반영 |
| Daily queue rules | DONE | profile 기반 생성, 최대 3개, expression 전용 sentence matching 추가 |
| Swipe navigation | DONE | 이전/다음 카드 preview affordance와 좌우 전환 반영 |
| Mode-aware follow-up surface | DONE | pronunciation / expression 분기 surface 반영 |
| Mode-aware routing | DONE | `goal_mode` 기반 follow-up 경험 분기 |
| Analytics | DONE | impression / seek play / record start / swipe 및 follow-up 이벤트 연결 |

## Files Modified

- apps/mobile/app/(tabs)/index.tsx
- apps/mobile/src/__tests__/daily-input-home.test.tsx
- apps/mobile/src/contexts/AuthContext.tsx
- apps/mobile/src/lib/analytics.ts
- apps/mobile/src/lib/daily-input.ts
- .moai/specs/SPEC-MOBILE-013/spec.md

## Verification

- `pnpm --dir apps/mobile typecheck`
- `pnpm --dir apps/mobile test -- --runInBand src/__tests__/daily-input-home.test.tsx`

## Follow-on Notes

- pronunciation 모드의 정교한 분석 리포트는 SPEC-MOBILE-014 이후 별도 품질 단계에서 확장한다.
- premium gating, 추천 고도화, 콘텐츠 메타 보강은 SPEC-MOBILE-014 / 015에서 이어서 다룬다.
